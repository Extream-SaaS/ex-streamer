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
    
        await publish('ex-gateway', { domain, action, command, payload: { ...payload }, user, socketId });
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
          // generate the URL to use \\
          // check that the start_date and end_date are valid in current range, otherwise don't encode, just provide single use streaming from NMS.
          const rehearsalCutoff = new Date(stream.start_date.getTime() - 30 * 60000);
          let url = 'rtmp://incoming.stream.extream.app/';
          if (stream.configuration.mode === 'live' && rehearsalCutoff > new Date()) {
            url += 'reheardal';
          }
          if (stream.configuration.mode === 'record' && rehearsalCutoff > new Date()) {
            url += 'recorder';
          }
          if (stream.configuration.mode === 'record' && rehearsalCutoff < new Date()) {
            url = 'expired';
          }
          if (new Date() > stream.end_date) {
            url = 'expired';
          }
          data.authkey = `${stream.id}|${user.token}`;
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

        // check that the start_date and end_date are valid in current range, otherwise don't encode, just provide single use streaming from NMS.
        const rehearsalCutoff = new Date(stream.start_date.getTime() - 30 * 60000);
        let status = 'live';
        let broadcast = true;
        if (stream.configuration.mode === 'live' && rehearsalCutoff > new Date()) {
          status = 'rehearsing';
          broadcast = false;
        }
        if (stream.configuration.mode === 'record' && rehearsalCutoff > new Date()) {
          status = 'recording';
          broadcast = false;
        }
        if (stream.configuration.mode === 'record' && rehearsalCutoff < new Date()) {
          status = 'expired';
          broadcast = false;
        }
        if (new Date() > stream.end_date) {
          status = 'expired';
          broadcast = false;
        }

        await publish('ex-gateway', { domain, action, command, payload: data, user });
        await publish('ex-streamer-incoming', { domain, action, command, payload: { ...data, broadcast, status }, user });
        if (broadcast && stream.configuration.mode === 'live') {
          await publish('ex-streamer-encoder', { domain, action, command, payload: data, user });
        }
        callback();
      } catch (error) {
        await publish('ex-streamer-incoming', { error: error.message, domain, action, command, payload, user });
        callback(0);
      }
      break;
  }
};