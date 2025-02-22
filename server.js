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

// Session management
const sessions = new Map();

// Transaction history
const transactionHistory = [];

// Mock user data with more complex structure
const users = {
  "user_default": {
    id: "usr_" + crypto.randomBytes(8).toString('hex'),
    balance: 100,
    tier: "standard", 
    purchaseCount: 0,
    lastActivity: Date.now(),
    transactionLimit: 500
  }
};

// Mock product data with more complex pricing structure
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
    stock: 1
  }
];

// Generate session token
app.post('/login', (req, res) => {
  const sessionToken = "sess_" + crypto.randomBytes(16).toString('hex');
  sessions.set(sessionToken, "user_default");
  res.json({ token: sessionToken });
});

// Helper function to calculate final price
function calculatePrice(product, user) {
  let finalPrice = product.basePrice;
  
  // Apply discount based on user's purchase history
  if (user.purchaseCount > 2) {
    finalPrice -= product.discount;
  }
  
  // Apply seasonal discount (subtle timing vulnerability)
  const currentHour = new Date().getHours();
  if (currentHour >= 2 && currentHour < 4) {
    finalPrice = Math.floor(finalPrice * 0.9);
  }
  
  return finalPrice;
}

// Complex purchase endpoint
app.post('/api/v2/commerce/purchase', (req, res) => {
  const { productId, quantity = 1, couponCode } = req.body;
  const sessionToken = req.headers['x-session-token'];
  
  // Validate session
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userId = sessions.get(sessionToken);
  const user = users[userId];
  
  // Update last activity
  user.lastActivity = Date.now();
  
  // Find product
  const product = products.find(p => p.id == productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  
  // Check tier requirement
  if (product.minimumTier !== user.tier && product.id !== 3) {
    return res.status(403).json({ error: 'Tier requirement not met' });
  }
  
  // Check stock
  if (product.stock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }
  
  // Calculate total price
  const finalPrice = calculatePrice(product, user) * quantity;
  
  // Apply coupon if valid
  let discountedPrice = finalPrice;
  if (couponCode === 'WELCOME10') {
    discountedPrice = Math.floor(finalPrice * 0.9);
  }
  
  // Process transaction
  const transactionId = "txn_" + crypto.randomBytes(8).toString('hex');
  
  // HERE'S THE HIDDEN VULNERABILITY:
  // We subtract the discounted price, but check against the original price
  user.balance -= discountedPrice;
  
  // Record transaction
  transactionHistory.push({
    id: transactionId,
    userId: user.id,
    productId: product.id,
    quantity: quantity,
    price: finalPrice,
    discountedPrice: discountedPrice,
    timestamp: Date.now()
  });
  
  // Update user stats
  user.purchaseCount += 1;
  product.stock -= quantity;
  
  // The complex condition that reveals the flag:
  // 1. Transaction limit check - original price would exceed limit, but discounted doesn't
  // 2. Special product ID check
  // 3. Time-based check adds another layer of obscurity
  if (finalPrice > user.transactionLimit && 
    discountedPrice <= user.transactionLimit && 
    product.id === 3) {
    return res.json({ 
    success: true,
    message: `Transaction processed: ${transactionId}`,
    flag: process.env.FLAG
    });
  }
  
  res.json({ 
    success: true,
    message: `Transaction processed: ${transactionId}`,
    newBalance: user.balance,
    receipt: {
      product: product.name,
      quantity: quantity,
      originalPrice: finalPrice,
      paidAmount: discountedPrice,
      timestamp: new Date().toISOString()
    }
  });
});

// Get user balance
app.get('/api/v2/user/balance', (req, res) => {
  const sessionToken = req.headers['x-session-token'];
  
  if (!sessionToken || !sessions.has(sessionToken)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const userId = sessions.get(sessionToken);
  const user = users[userId];
  
  res.json({ balance: user.balance });
});

app.get('/', (req, res) => {
  res.send('API Gateway v2.0');
});

app.listen(3000, () => {
  console.log('Service running on http://localhost:3000');
});