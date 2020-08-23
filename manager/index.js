const Firestore = require('@google-cloud/firestore');
const projectId = 'stoked-reality-284921';

const publish = (
  topicName = 'ex-gateway',
  data = {}
) => {
  const {PubSub} = require('@google-cloud/pubsub');
  // Instantiates a client
  const pubsub = new PubSub({projectId});

  async function publishMessage() {
    const dataBuffer = Buffer.from(JSON.stringify(data));

    const messageId = await pubsub.topic(topicName).publish(dataBuffer);
    return messageId;
  }

  return publishMessage();
};

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
exports.manage = async (event, context, callback) => {
  const message = event && event.data ? JSON.parse(Buffer.from(event.data, 'base64').toString()) : null;
  if (message === null) {
    callback();
  }
  const {domain, action, command, socketId, payload, user} = message;
  const db = new Firestore({
    projectId,
  });
  console.log('message', message);
  if (message.payload.start_date) {
    message.payload.start_date = Firestore.Timestamp.fromDate(new Date(Date.parse(message.payload.start_date)));
  }
  if (message.payload.end_date) {
    message.payload.end_date = Firestore.Timestamp.fromDate(new Date(Date.parse(message.payload.end_date)));
  }
  switch (command) {
    case 'create':
      try {
        const docRef = db.collection('streams').doc();
    
        await docRef.set({
          ...payload,
          addedBy: user.id,
          addedAt: Firestore.FieldValue.serverTimestamp()
        });
   
        await publish('ex-gateway', { domain, action, command, payload: { ...payload, id: docRef.id }, user, socketId });
        callback();
      } catch (error) {
        await publish('ex-gateway', { error: error.message, domain, action, command, payload, user, socketId });
        callback(0);
      }
      break;
    case 'update':
      try {
        const docRef = db.collection('streams').doc(payload.id);
    
        await docRef.set({
          ...payload,
          updatedBy: user.id,
          updatedAt: Firestore.FieldValue.serverTimestamp()
        }, {
          merge: true
        });
    
        const messageId = await publish('ex-gateway', { domain, action, command, payload, user, socketId });
        console.log(messageId, 'ex-gateway', { domain, action, command, payload, user, socketId });
        callback();
      } catch (error) {
        await publish('ex-gateway', { error: error.message, domain, action, command, payload, user, socketId });
        callback(0);
      }
      break;
    case 'read':
      try {
        const docRef = db.collection('streams').doc(payload.id);
    
        const stream = await docRef.get();

        if (!stream.exists) {
          throw new Error('item not found');
        }
    
        await publish('ex-gateway', { domain, action, command, payload: stream.data(), user, socketId });
        callback();
      } catch (error) {
        await publish('ex-gateway', { error: error.message, domain, action, command, payload, user, socketId });
        callback(0);
      }
      break;
    case 'get':
      try {
        const docRef = db.collection('streams').doc(payload.id);
        const stream = await docRef.get();
        
        if (!stream.exists) {
          throw new Error('item not found');
        }

        let data = stream.data();
        if (domain === 'client') {
          if (data.configuration.actor !== user.id) {
            throw new Error('not a designated actor');
          }
          // generate the URL to use \\
          // check that the start_date and end_date are valid in current range, otherwise don't encode, just provide single use streaming from NMS.
          const startDate = data.start_date.toDate();
          const endDate = data.end_date.toDate();
          const rehearsalCutoff = new Date(startDate.getTime() - 30 * 60000);
          let url = process.env.EXRTMP;
          if ((data.configuration.mode === 'live' || (data.configuration.mode === 'record' && data.configuration.broadcast)) && rehearsalCutoff > new Date()) {
            url += 'rehearsal';
          } else if (data.configuration.mode === 'live') {
            url += 'live';
          }
          if (data.configuration.mode === 'record' && ((!data.configuration.broadcast && rehearsalCutoff > new Date())) || (data.configuration.broadcast && rehearsalCutoff < new Date())) {
            url += 'recorder';
          }
          if (data.configuration.mode === 'record' && !data.configuration.broadcast && rehearsalCutoff < new Date()) {
            url = 'expired';
          }
          if (new Date() > endDate) {
            url = 'expired';
          }
          data.streamkey = `${docRef.id}|${user.token}`;
          data.url = url;
        }
        await publish('ex-gateway', { domain, action, command, payload: data, user, socketId });
        callback();
      } catch (error) {
        await publish('ex-gateway', { error: error.message, domain, action, command, payload, user, socketId });
        callback(0);
      }
      break;
    case 'activate':
      try {
        // this is only available for client domain \\
        if (domain !== 'client') {
          throw new Error('only clients activate');
        }
        const docRef = db.collection('streams').doc(payload.id);
        const stream = await docRef.get();
        
        if (!stream.exists) {
          throw new Error('item not found');
        }

        let data = stream.data();
        const startDate = data.start_date.toDate();
        const endDate = data.end_date.toDate();

        // check that the start_date and end_date are valid in current range, otherwise don't encode, just provide single use streaming from NMS.
        const rehearsalCutoff = new Date(startDate.getTime() - 30 * 60000);
        let status = 'live';
        let broadcast = true;
        if ((data.configuration.mode === 'live' || (data.configuration.mode === 'record' && data.configuration.broadcast)) && rehearsalCutoff > new Date()) {
          status = 'rehearsing';
          broadcast = false;
        }
        if (data.configuration.mode === 'record' && ((!data.configuration.broadcast && rehearsalCutoff > new Date())) || (data.configuration.broadcast && rehearsalCutoff < new Date())) {
          status = 'recording';
          if (!data.configuration.broadcast) {
            broadcast = false;
          }
        }
        if (data.configuration.mode === 'record' && !data.configuration.broadcast && rehearsalCutoff < new Date()) {
          status = 'expired';
          broadcast = false;
        }
        if (new Date() > endDate) {
          status = 'expired';
          broadcast = false;
        }

        const published = [];
        published.push(publish('ex-gateway', { domain, action, command, payload: data, user }));
        published.push(publish('ex-streamer-incoming', { domain, action, command, payload: { ...data, broadcast, status }, user }));
        if (broadcast) {
          // fire up the listener to encode to the bucket
          published.push(publish('ex-streamer-encoder', { domain, action, command, payload: data, user }));
        }
        await Promise.all(published);
        callback();
      } catch (error) {
        await publish('ex-streamer-incoming', { error: error.message, domain, action, command, payload, user });
        callback(0);
      }
      break;
  }
};