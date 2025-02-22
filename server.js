const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: '*',
  credentials: true,
}));

const sessions = new Map();
const transactionHistory = [];

const users = {
  "user_default": {
    id: "usr_" + crypto.randomBytes(8).toString('hex'),
    balance: 500,  // Increased balance to make it easier to reach the condition
    tier: "standard", 
    purchaseCount: 1, // Ensuring they already made a purchase
    transactionLimit: 300
  }
};

const products = [
  { id: 3, name: 'Hidden Item', basePrice: 150, discount: 0, minimumTier: "standard", stock: 5 }
];

// Generate session token
app.post('/login', (req, res) => {
  const sessionToken = "sess_" + crypto.randomBytes(16).toString('hex');
  sessions.set(sessionToken, "user_default");
  res.json({ token: sessionToken });
});

app.post('/balance', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const userId = sessions.get(sessionToken);
  const user = users[userId];
  res.json({ balance: user.balance });
});

app.post('/api/v2/commerce/purchase', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const sessionToken = req.headers['x-session-token'];

  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = sessions.get(sessionToken);
  const user = users[userId];

  const product = products.find(p => p.id == productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

  const finalPrice = product.basePrice * quantity;
  
  if (user.balance < finalPrice) return res.status(400).json({ error: 'Insufficient balance' });

  user.balance -= finalPrice;
  product.stock -= quantity;
  user.purchaseCount += 1;

  const transactionId = "txn_" + crypto.randomBytes(8).toString('hex');
  transactionHistory.push({ id: transactionId, userId: user.id, productId: product.id, quantity, price: finalPrice });

  if (product.id === 3 && finalPrice <= user.transactionLimit && user.purchaseCount > 1) {
    return res.json({ 
      success: true,
      message: `Transaction processed: ${transactionId}`,
      flag: process.env.FLAG 
    });
  }

  res.json({ 
    success: true,
    message: `Transaction processed: ${transactionId}`,
    newBalance: user.balance 
  });
});

app.get('/', (req, res) => {
  res.send('API Gateway v2.0');
});

app.listen(3000, () => {
  console.log('Service running on http://localhost:3000');
});
