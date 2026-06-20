const instana = require('@instana/collector');
// init tracing
instana({ tracing: { enabled: true } });

const mongoClient = require('mongodb').MongoClient;
const bodyParser = require('body-parser');
const express = require('express');
const pino = require('pino');
const expPino = require('express-pino-logger');

const logger = pino({
    level: 'info',
    prettyPrint: false,
    useLevelLabels: true
});
const expLogger = expPino({ logger: logger });

// MongoDB
var db;
var collection;
var mongoConnected = false;

const app = express();

app.use(expLogger);

app.use((req, res, next) => {
    res.set('Timing-Allow-Origin', '*');
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ HEALTH CHECK (DO NOT BREAK)
app.get('/health', (req, res) => {
    res.json({
        app: 'OK',
        mongo: mongoConnected
    });
});

// ✅ ALL PRODUCTS WORKING
app.get('/products', (req, res) => {
    if (mongoConnected) {
        collection.find({}).toArray()
            .then(products => res.json(products))
            .catch(e => {
                req.log.error(e);
                res.status(500).send(e);
            });
    } else {
        res.status(500).send('database not available');
    }
});


// 🔥🔥🔥 MAIN CHANGE (PRODUCT PAGE BREAK) 🔥🔥🔥
// ❌ THIS WILL BREAK PRODUCT PAGE WHEN USER CLICKS
app.get('/product/:sku', (req, res) => {
    console.log("🚨 SRE TEST: Product API failure triggered");

    // return 500 error
    return res.status(500).send("Product page intentionally broken");
});


// ✅ OTHER APIs (keep unchanged)
app.get('/products/:cat', (req, res) => {
    if (mongoConnected) {
        collection.find({ categories: req.params.cat })
            .sort({ name: 1 })
            .toArray()
            .then(products => res.json(products))
            .catch(e => res.status(500).send(e));
    } else {
        res.status(500).send('database not available');
    }
});

app.get('/categories', (req, res) => {
    if (mongoConnected) {
        collection.distinct('categories')
            .then(categories => res.json(categories))
            .catch(e => res.status(500).send(e));
    } else {
        res.status(500).send('database not available');
    }
});

app.get('/search/:text', (req, res) => {
    if (mongoConnected) {
        collection.find({ '$text': { '$search': req.params.text }})
            .toArray()
            .then(hits => res.json(hits))
            .catch(e => res.status(500).send(e));
    } else {
        res.status(500).send('database not available');
    }
});

// ✅ MongoDB connect
function mongoConnect() {
    return new Promise((resolve, reject) => {
        var mongoURL = process.env.MONGO_URL || 'mongodb://mongodb:27017/catalogue';
        mongoClient.connect(mongoURL, (error, client) => {
            if (error) {
                reject(error);
            } else {
                db = client.db('catalogue');
                collection = db.collection('products');
                resolve('connected');
            }
        });
    });
}

function mongoLoop() {
    mongoConnect().then(() => {
        mongoConnected = true;
        logger.info('MongoDB connected');
    }).catch(e => {
        logger.error(e);
        setTimeout(mongoLoop, 2000);
    });
}

mongoLoop();

// ✅ START APP
const port = process.env.CATALOGUE_SERVER_PORT || '8080';
app.listen(port, () => {
    logger.info('Started on port', port);
});