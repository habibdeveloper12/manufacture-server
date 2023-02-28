const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.SK_LIVE_KEY);
const port = process.env.PORT || 5000;
// method
app.use(cors())
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.it6xt.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  const verifyJWt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).send({ message: "Unauthorized" })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
      if (err) {
        return res.status(402).send({ message: "Forbidden access" })
      }
      req.decoded = decoded

      next()

    });
  }
  try {
    await client.connect();

    const toolsCollection = client.db("manufacturing-tools").collection("tools");
    const ordersCollection = client.db("manufacturing-tools").collection("orders");
    const userCollection = client.db("manufacturing-tools").collection("user");
    const paymentCollection = client.db("manufacturing-tools").collection("payment");
    const reviewCollection = client.db("manufacturing-tools").collection("review");
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requestFind = await userCollection.findOne({ email: requester });
      if (requestFind.role === 'admin') {
        next()
      }
      else {

        return res.status(403).send({ message: "Forbidden" })

      }

    }

    app.get('/tools', async (req, res) => {
      const query = {}
      const result = await toolsCollection.find(query).toArray();
      res.send(result)
    })
    app.get('/tools/:id', verifyJWt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await toolsCollection.findOne(query)
      res.send(result)
    })
    app.post('/orders', verifyJWt, async (req, res) => {
      const body = req.body
      const result = await ordersCollection.insertOne(body);
      res.send({ result })
    })
    app.post('/review', verifyJWt, async (req, res) => {
      const body = req.body
      const result = await reviewCollection.insertOne(body);
      res.send({ result })
    })
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })
    app.post('/tools', verifyJWt, async (req, res) => {
      const body = req.body;
      const result = await toolsCollection.insertOne(body);
      res.send({ result })
    })
    app.get('/user', verifyJWt, async (req, res) => {
      const query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/admin/:email', verifyJWt, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const findAdmin = await userCollection.findOne({ email: email })



      const isAdmin = findAdmin.role === 'admin';
      res.send({ admin: isAdmin })
    })
    app.put('/user/admin/:email', verifyJWt, verifyAdmin, async (req, res) => {
      const email = req.params.email;


      const filter = { email: email };

      const updateDoc = {
        $set: { role: "admin" },

      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send({ result });



    })


    app.get('/payment/:id', verifyJWt, async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const query = { _id: ObjectId(id) }
      const result = await ordersCollection.findOne(query)
      res.send(result)
    })
    app.get('/orders', async (req, res) => {


      const result = await ordersCollection.find().toArray()
      res.send(result)
    })
    // app.get('/orders/:email', async (req, res) => {
    //   // const authHeader = req.headers.authorization;
    //   // console.log(authHeader);

    //   const email = req.params.email;
    //   console.log(email);

    //   const query = { email: email }


    //   const cursor = ordersCollection.find(query);
    //   const cursurArray = await cursor.toArray()
    //   res.send(cursurArray)


    // })
    app.get('/orders/:email', (req, res) => {


      const queryEmail = req.params.email;
      ordersCollection.find({ email: queryEmail })
        .toArray((err, docs) => res.send(docs))
    })
    app.post('/create-payment-intent', verifyJWt, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({ clientSecret: paymentIntent.client_secret })
    });


    app.patch('/orders/:id', verifyJWt, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }

      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
    })


    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;





      const filter = { email: email };

      const options = { upsert: true };
      const updateDoc = {
        $set: user,

      };
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' });
      console.log(token);


      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send({ result, accessToken: token });
    })


    app.delete('/orders/:id', verifyJWt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await ordersCollection.deleteOne(query);
      res.send(result)
    })

  }
  finally {

  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(port);

})
app.get('/', (req, res) => {
  res.send("success the connection")
  console.log(`connection seccess ${port}`);

})