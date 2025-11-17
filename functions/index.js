const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Dialogflow webhook for GCEF events.
 */
exports.dialogflowWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const intent = req.body.queryResult?.intent?.displayName;
    const parameters = req.body.queryResult?.parameters;

    if (intent === "GetEventByName") {
      const eventName = parameters?.eventName?.toLowerCase();

      // Query Firestore by eventNameLower
      const snapshot = await db
        .collection("events")
        .where("eventNameLower", "==", eventName)
        .get();

      if (snapshot.empty) {
        res.json({
          fulfillmentText: `I couldn't find any event named "${parameters?.eventName}".`,
        });
        return;
      }

      const event = snapshot.docs[0].data();

      res.json({
        fulfillmentText: `📅 Event: ${event.eventName}\n🏢 Department: ${event.department}\n📝 Description: ${event.description}\n👤 Professor: ${event.professor}\n📍 Location: ${event.location}\n⏰ Starts: ${event.startDate.toDate().toLocaleString()}\n⏰ Ends: ${event.endDate.toDate().toLocaleString()}`,
      });
      return;
    }

    res.json({ fulfillmentText: "I didn't understand that." });
  } catch (err) {
    console.error(err);
    res.json({ fulfillmentText: "Something went wrong." });
  }
});
