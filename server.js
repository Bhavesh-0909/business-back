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
const transactionHistory = new Map();

// Initialize with more clear starting values
const users = {
  "user_default": {
    id: "usr_" + crypto.randomBytes(8).toString('hex'),
    balance: 1000,  // Higher starting balance
    tier: "standard",
    purchaseCount: 0,
    transactionLimit: 500  // Match the frontend's displayed limit
  }
};

// Expanded product list to match frontend
const products = [
  { 
    id: 1, 
    name: 'Basic Item', 
    basePrice: 50, 
    discount: 0, 
    minimumTier: "standard", 
    stock: 10 
  },
  { 
    id: 2, 
    name: 'Premium Item', 
    basePrice: 200, 
    discount: 5, 
    minimumTier: "premium", 
    stock: 3 
  },
  { 
    id: 3, 
    name: 'Hidden Item', 
    basePrice: 150, 
    discount: 0, 
    minimumTier: "standard", 
    stock: 5 
  }
];

// Improved session handling
app.post('/login', (req, res) => {
  const sessionToken = "sess_" + crypto.randomBytes(16).toString('hex');
  sessions.set(sessionToken, "user_default");
  res.json({ 
    token: sessionToken,
    user: {
      balance: users["user_default"].balance,
      tier: users["user_default"].tier,
      transactionLimit: users["user_default"].transactionLimit
    }
  });
});

// Changed to GET method to match standard REST practices
app.get('/api/v2/user/balance', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const userId = sessions.get(sessionToken);
  const user = users[userId];
  res.json({ 
    balance: user.balance,
    tier: user.tier,
    transactionLimit: user.transactionLimit
  });
});

app.post('/api/v2/commerce/purchase', (req, res) => {
  const { productId, quantity = 1, couponCode } = req.body;
  const sessionToken = req.headers['x-session-token'];

  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = sessions.get(sessionToken);
  const user = users[userId];

  const product = products.find(p => p.id === parseInt(productId));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (product.stock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  // Calculate price with potential discount
  let finalPrice = product.basePrice * quantity;
  if (product.discount > 0) {
    finalPrice = finalPrice * (1 - product.discount / 100);
  }

  // Check balance after applying discount
  if (user.balance < finalPrice) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Process transaction
  user.balance -= finalPrice;
  product.stock -= quantity;
  user.purchaseCount += 1;

  const transactionId = "txn_" + crypto.randomBytes(8).toString('hex');
  transactionHistory.set(transactionId, {
    userId: user.id,
    productId: product.id,
    quantity,
    basePrice: product.basePrice,
    finalPrice,
    timestamp: new Date()
  });

  // Flag condition: Purchase Hidden Item (id: 3) with transaction value under limit
  if (product.id === 3 && finalPrice <= user.transactionLimit) {
    return res.json({ 
      success: true,
      message: `Transaction successful! Transaction ID: ${transactionId}`,
      newBalance: user.balance,
      flag: process.env.FLAG
    });
  }

  res.json({ 
    success: true,
    message: `Transaction successful! Transaction ID: ${transactionId}`,
    newBalance: user.balance
  });
});

// New endpoint to get available products
app.get('/api/v2/products', (req, res) => {
  res.json(products);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});