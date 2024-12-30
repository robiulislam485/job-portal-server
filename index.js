const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;


app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send(({ message: 'Unauthorized Access' }))
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send(({ message: 'Unauthorized Access' }))
    }
    req.user = decoded;
    next()
  })


}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nsqqt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");


    const jobsCollection = client.db('jobPortal').collection('jobs');
    const jobsApplicationCollection = client.db('jobPortal').collection('jobs_applications');

    // auth related apis
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false
        })
        .send({ success: true })
    })

    //job related apis 

    app.get('/jobs', async (req, res) => {
      const email = req.query.email;
      const sort = req.query?.sort;
      const search = req.query?.search;
      const min = req.query?.min;
      const max = req.query?.max;
      let query = {};
      let sortQuery = {};
      if (email) {
        query = {
          hr_email: email
        }
      }
      if (sort == "true") {
        sortQuery = { "salaryRange.min": -1 }
      }
      if (search) {
        query.location = { $regex: search, $options: "i" }
      }
      if (min && max) {
        query = {
          ...query,
          "salaryRange.min": { $gte: parseInt(min) },
          "salaryRange.max": { $lte: parseFloat(max) }
        }
      }
      const cursor = jobsCollection.find(query).sort(sortQuery);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result)
    })

    app.post('/jobs', async (req, res) => {
      const job = req.body;
      const result = await jobsCollection.insertOne(job);
      res.send(result);
    })



    // job application apis
    app.get('/job-application/jobs/:job_id', async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await jobsApplicationCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/job-application', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { appliciant_email: email };
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }
      const result = await jobsApplicationCollection.find(query).toArray();
      // not good way
      for (const application of result) {
        const query = { _id: new ObjectId(application.job_id) }
        const job = await jobsCollection.findOne(query);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result);
    })


    app.post('/job-applications', async (req, res) => {
      const application = req.body;
      const result = await jobsApplicationCollection.insertOne(application);
      res.send(result);
    })

    app.patch('/job-applications/:id', async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status
        }
      }
      const result = await jobsApplicationCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })




  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send("Job is falling from sky")
})

app.listen(port, () => {
  console.log(`Job is waiting at:${port}`);
})

