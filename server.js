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
  methods: ['GET', 'POST'],
}));

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
    stock: 1000000000
  },
  { 
    id: 2, 
    name: 'Premium Item', 
    basePrice: 200, 
    discount: 5, 
    minimumTier: "premium", 
    stock: 3000000000
  },
  { 
    id: 3, 
    name: 'Hidden Item', 
    basePrice: 150, 
    discount: 0, 
    minimumTier: "standard", 
    stock: 5000000000
  }
];

// Simplified login function
app.post('/login', (req, res) => {
  const user = users["user_default"];
  res.json({ 
    user: {
      id: user.id,
      balance: user.balance,
      tier: user.tier,
      transactionLimit: user.transactionLimit
    }
  });
});

app.get('/api/v2/user/balance', (req, res) => {
  const user = users["user_default"]; // Assuming a default user
  res.json({ 
    balance: user.balance,
    tier: user.tier,
    transactionLimit: user.transactionLimit
  });
});

// Modified purchase endpoint
app.post('/api/v2/commerce/purchase', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const user = users["user_default"]; // Assuming a default user
  const product = products.find(p => p.id === parseInt(productId));
  
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.stock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  let finalPrice = product.basePrice * quantity;
  
  // Apply discount if any
  if (product.discount > 0) {
    finalPrice = finalPrice * (1 - product.discount / 100);
  }

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
    if (product.id === 3 && user.balance <= -100000) {
      return res.json({
        success: true,
        message: `Transaction successful! ID: ${transactionId}`,
        newBalance: user.balance,
        flag: process.env.FLAG 
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
  res.json(products);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});