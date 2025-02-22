const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
dotenv.config();

const app = express();
app.use(express.json());

// Modified CORS settings to be more permissive
app.use(cors({
  origin: '*',
  credentials: true,
}));

const sessions = new Map();
const transactionHistory = new Map();

// Initialize with modified starting values
const users = {
  "user_default": {
    id: "usr_" + crypto.randomBytes(8).toString('hex'),
    balance: 1000,
    tier: "standard",
    purchaseCount: 0,
    transactionLimit: 500
  }
};

const products = [
  { 
    id: 1, 
    name: 'Basic Item', 
    basePrice: 50, 
    discount: 0, 
    minimumTier: "standard", 
    stock: 100 
  },
  { 
    id: 2, 
    name: 'Premium Item', 
    basePrice: 200, 
    discount: 5, 
    minimumTier: "premium", 
    stock: 30 
  },
  { 
    id: 3, 
    name: 'Hidden Item', 
    basePrice: 150, 
    discount: 0, 
    minimumTier: "standard", 
    stock: 50 
  }
];

// Simplified session management
app.post('/login', (req, res) => {
  const sessionToken = "sess_" + crypto.randomBytes(16).toString('hex');
  sessions.set(sessionToken, "user_default");
  
  // Send more detailed user info in response
  const user = users["user_default"];
  res.json({ 
    token: sessionToken,
    user: {
      id: user.id,
      balance: user.balance,
      tier: user.tier,
      transactionLimit: user.transactionLimit
    }
  });
});

app.get('/api/v2/user/balance', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  
  // More permissive session checking
  if (!sessions.has(sessionToken)) {
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

// Modified purchase endpoint with business logic vulnerability
app.post('/api/v2/commerce/purchase', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const sessionToken = req.headers['x-session-token'];

  if (!sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = sessions.get(sessionToken);
  const user = users[userId];
  const product = products.find(p => p.id === parseInt(productId));
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.stock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  // Vulnerability: Integer overflow in price calculation
  // Using floating point numbers for price calculations
  let finalPrice = product.basePrice * quantity;
  
  // Apply discount if any
  if (product.discount > 0) {
    finalPrice = finalPrice * (1 - product.discount / 100);
  }

  // Vulnerability: Negative quantity check missing
  // This allows for negative quantities which can increase balance
  if (finalPrice <= user.transactionLimit && finalPrice >= 0) {
    // Process transaction
    user.balance -= finalPrice;
    product.stock -= quantity;
    user.purchaseCount += 1;

    const transactionId = "txn_" + crypto.randomBytes(8).toString('hex');
    
    // Store transaction
    transactionHistory.set(transactionId, {
      userId: user.id,
      productId: product.id,
      quantity,
      finalPrice,
      timestamp: new Date()
    });

    // Flag condition: Successfully purchase hidden item with specific conditions
    if (product.id === 3 && user.balance >= 800) {
      return res.json({
        success: true,
        message: `Transaction successful! ID: ${transactionId}`,
        newBalance: user.balance,
        flag: "flag{bus1ness_l0g1c_byp4ss3d}" // Replace with actual flag from .env
      });
    }

    return res.json({
      success: true,
      message: `Transaction successful! ID: ${transactionId}`,
      newBalance: user.balance
    });
  }

  res.status(400).json({ error: 'Transaction limit exceeded or invalid amount' });
});

app.get('/api/v2/products', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  
  if (!sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  res.json(products);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});