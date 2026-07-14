/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_RECIPES } from './src/data/initialRecipes.ts';
import fs from 'fs';
import crypto from 'crypto';
import Razorpay from 'razorpay';

// Safe path resolution for both ES Modules (development) and CommonJS (compiled production) using process.cwd()
const currentDirname = process.cwd();

// Database initialization
const DB_PATH = path.join(currentDirname, 'src', 'data', 'recipes.json');
let RECIPES_STORE = [...INITIAL_RECIPES];

try {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
    RECIPES_STORE = JSON.parse(fileContent);
    console.log(`Loaded ${RECIPES_STORE.length} recipes from local JSON database.`);
  } else {
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_RECIPES, null, 2), 'utf-8');
    console.log(`Initialized database file with ${INITIAL_RECIPES.length} default recipes.`);
  }
} catch (err) {
  console.error('Failed to load or initialize recipe database file:', err);
}

// Users Database initialization
const USERS_DB_PATH = path.join(currentDirname, 'src', 'data', 'users.json');
let USERS_STORE: any[] = [];

try {
  const dir = path.dirname(USERS_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(USERS_DB_PATH)) {
    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf-8');
    USERS_STORE = JSON.parse(fileContent);
    console.log(`Loaded ${USERS_STORE.length} users from local JSON database.`);
  } else {
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify([], null, 2), 'utf-8');
    console.log(`Initialized empty user database file.`);
  }
} catch (err) {
  console.error('Failed to load or initialize user database file:', err);
}

// Active user session store in memory
const ACTIVE_SESSIONS: Record<string, { _id: string; email: string; name: string }> = {};


const ENRICHED_RECIPES_META: Record<string, {
  macros: { calories: number; protein: number; carbs: number; fats: number };
  is_diabetic_friendly: boolean;
  is_keto: boolean;
  is_high_protein: boolean;
}> = {
  "rec_1": {
    macros: { calories: 320, protein: 38, carbs: 4, fats: 16 },
    is_diabetic_friendly: true,
    is_keto: true,
    is_high_protein: true
  },
  "rec_2": {
    macros: { calories: 250, protein: 6, carbs: 42, fats: 7 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_3": {
    macros: { calories: 420, protein: 18, carbs: 12, fats: 34 },
    is_diabetic_friendly: false,
    is_keto: true,
    is_high_protein: true
  },
  "rec_4": {
    macros: { calories: 380, protein: 8, carbs: 55, fats: 14 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_5": {
    macros: { calories: 450, protein: 6, carbs: 48, fats: 26 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_6": {
    macros: { calories: 290, protein: 4, carbs: 32, fats: 16 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_7": {
    macros: { calories: 340, protein: 14, carbs: 28, fats: 18 },
    is_diabetic_friendly: true,
    is_keto: false,
    is_high_protein: true
  },
  "rec_8": {
    macros: { calories: 390, protein: 7, carbs: 52, fats: 18 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_9": {
    macros: { calories: 310, protein: 3, carbs: 41, fats: 15 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_10": {
    macros: { calories: 280, protein: 6, carbs: 44, fats: 8 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_11": {
    macros: { calories: 240, protein: 5, carbs: 26, fats: 13 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "rec_12": {
    macros: { calories: 480, protein: 34, carbs: 10, fats: 32 },
    is_diabetic_friendly: false,
    is_keto: true,
    is_high_protein: true
  },
  "bev_001": {
    macros: { calories: 90, protein: 2, carbs: 12, fats: 3 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  },
  "bev_002": {
    macros: { calories: 180, protein: 4, carbs: 22, fats: 8 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  }
};

const getVideoLoopUrl = (instructionText: string, index: number): string => {
  const text = instructionText.toLowerCase();
  
  if (text.includes("boil") || text.includes("simmer") || text.includes("tea") || text.includes("water") || text.includes("milk") || text.includes("उबाल")) {
    return `https://res.cloudinary.com/dl7m389wy/video/upload/q_auto,vc_auto,w_480/v1720352000/boiling_simmer.mp4`;
  }
  if (text.includes("fry") || text.includes("sauté") || text.includes("saute") || text.includes("grill") || text.includes("heat") || text.includes("pan") || text.includes("भून") || text.includes("तल")) {
    return `https://res.cloudinary.com/dl7m389wy/video/upload/q_auto,vc_auto,w_480/v1720352000/frying_pan.mp4`;
  }
  if (text.includes("bake") || text.includes("oven") || text.includes("preheat") || text.includes("सेक")) {
    return `https://res.cloudinary.com/dl7m389wy/video/upload/q_auto,vc_auto,w_480/v1720352000/baking_oven.mp4`;
  }
  if (text.includes("cut") || text.includes("chop") || text.includes("peel") || text.includes("wash") || text.includes("धोकर")) {
    return `https://res.cloudinary.com/dl7m389wy/video/upload/q_auto,vc_auto,w_480/v1720352000/cutting_prep.mp4`;
  }
  
  return `https://res.cloudinary.com/dl7m389wy/video/upload/q_auto,vc_auto,w_480/v1720352000/mixing_bowl.mp4`;
};

const getIngredientSubstitutes = (name: string): { name: string; ratio: string }[] | undefined => {
  const lowercaseName = name.toLowerCase();
  if (lowercaseName.includes("sugar")) {
    return [
      { name: "Jaggery", ratio: "1:1" },
      { name: "Honey", ratio: "1:0.7" },
      { name: "Stevia", ratio: "1:0.1" }
    ];
  }
  if (lowercaseName.includes("chicken")) {
    return [
      { name: "Paneer (Cottage Cheese)", ratio: "1:0.8" },
      { name: "Tofu", ratio: "1:0.9" },
      { name: "Soya Chunks", ratio: "1:0.5" }
    ];
  }
  if (lowercaseName.includes("yogurt") || lowercaseName.includes("curd")) {
    return [
      { name: "Vegan Cashew Curd", ratio: "1:1" },
      { name: "Coconut Yogurt", ratio: "1:1" }
    ];
  }
  if (lowercaseName.includes("milk")) {
    return [
      { name: "Almond Milk", ratio: "1:1" },
      { name: "Oat Milk", ratio: "1:1" },
      { name: "Soy Milk", ratio: "1:1" }
    ];
  }
  if (lowercaseName.includes("ghee") || lowercaseName.includes("butter")) {
    return [
      { name: "Olive Oil", ratio: "1:0.8" },
      { name: "Coconut Oil", ratio: "1:0.9" }
    ];
  }
  if (lowercaseName.includes("wheat flour") || lowercaseName.includes("atta") || lowercaseName.includes("flour")) {
    return [
      { name: "Almond Flour", ratio: "1:0.8" },
      { name: "Gluten-Free Flour Mix", ratio: "1:1" }
    ];
  }
  if (lowercaseName.includes("paneer")) {
    return [
      { name: "Tofu", ratio: "1:1" },
      { name: "Soya Paneer", ratio: "1:1" }
    ];
  }
  if (lowercaseName.includes("potatoes") || lowercaseName.includes("potato")) {
    return [
      { name: "Sweet Potatoes", ratio: "1:1" },
      { name: "Cauliflower Florets", ratio: "1:1.2" }
    ];
  }
  return undefined;
};

const enrichRecipe = (recipe: any) => {
  const meta = ENRICHED_RECIPES_META[recipe._id] || {
    macros: { calories: 300, protein: 10, carbs: 35, fats: 12 },
    is_diabetic_friendly: false,
    is_keto: false,
    is_high_protein: false
  };

  const stepsWithVideos = recipe.steps.map((step: any, index: number) => ({
    ...step,
    video_loop_url: getVideoLoopUrl(step.instruction, index)
  }));

  const ingredientsWithSubstitutes = recipe.ingredients.map((ing: any) => ({
    ...ing,
    substitutes: getIngredientSubstitutes(ing.name)
  }));

  const indexInStore = RECIPES_STORE.findIndex(r => r._id === recipe._id);
  const isPremium = indexInStore >= 3;

  return {
    ...recipe,
    ...meta,
    isPremium,
    ingredients: ingredientsWithSubstitutes,
    steps: stepsWithVideos
  };
};

async function startServer() {
  const app = express();
  const port = 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  // GET all recipes (with search & filter options)
  app.get('/api/recipes', (req, res) => {
    try {
      const { search, category, difficulty, fridge, is_diabetic_friendly, is_keto, is_high_protein } = req.query;
      let filtered = RECIPES_STORE.map(enrichRecipe);

      if (category && category !== 'All') {
        filtered = filtered.filter(r => r.category.toLowerCase() === (category as string).toLowerCase());
      }

      if (difficulty && difficulty !== 'All') {
        filtered = filtered.filter(r => r.difficulty.toLowerCase() === (difficulty as string).toLowerCase());
      }

      if (is_diabetic_friendly === 'true') {
        filtered = filtered.filter(r => r.is_diabetic_friendly);
      }

      if (is_keto === 'true') {
        filtered = filtered.filter(r => r.is_keto);
      }

      if (is_high_protein === 'true') {
        filtered = filtered.filter(r => r.is_high_protein);
      }

      if (search) {
        const query = (search as string).toLowerCase().trim();
        filtered = filtered.filter(r => {
          const matchTitle = r.title.toLowerCase().includes(query);
          const matchDesc = r.description?.toLowerCase().includes(query);
          const matchIngredients = r.ingredients.some(ing => ing.name.toLowerCase().includes(query));
          const matchCategory = r.category.toLowerCase().includes(query);
          return matchTitle || matchDesc || matchIngredients || matchCategory;
        });
      }

      if (fridge) {
        // Algorithmic overlap calculation similar to MongoDB Aggregation Pipeline
        const userIngredients = (fridge as string)
          .split(',')
          .map(i => i.trim().toLowerCase())
          .filter(Boolean);

        if (userIngredients.length > 0) {
          const scored = filtered.map(recipe => {
            const recipeIngs = recipe.ingredients.map(ing => ing.name.toLowerCase());
            let matchedCount = 0;
            userIngredients.forEach(userIng => {
              if (recipeIngs.some(recipeIng => recipeIng.includes(userIng) || userIng.includes(recipeIng))) {
                matchedCount++;
              }
            });

            // Score: percentage of matched ingredients out of total recipe ingredients
            const overlapScore = recipe.ingredients.length > 0 
              ? Math.round((matchedCount / recipe.ingredients.length) * 100) 
              : 0;

            return {
              ...recipe,
              overlapScore,
              matchedCount,
            };
          });

          // Filter to those with at least one match and sort by score descending
          filtered = scored
            .filter(r => (r as any).matchedCount > 0)
            .sort((a, b) => (b as any).overlapScore - (a as any).overlapScore) as any;
        }
      }

      res.json(filtered);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  // GET single recipe by ID or Slug
  app.get('/api/recipes/:idOrSlug', (req, res) => {
    try {
      const { idOrSlug } = req.params;
      const recipe = RECIPES_STORE.find(r => r._id === idOrSlug || r.slug === idOrSlug);
      
      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
      
      res.json(enrichRecipe(recipe));
    } catch (error) {
      console.error('Error fetching recipe:', error);
      res.status(500).json({ error: 'Failed to fetch recipe' });
    }
  });

  // ==========================================
  // AUTHENTICATION & LOGIN SYSTEM API ROUTES
  // ==========================================

  // 1. Register User
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
      }

      const emailLower = email.toLowerCase().trim();
      const userExists = USERS_STORE.some(u => u.email.toLowerCase() === emailLower);
      if (userExists) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }

      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      const _id = 'user_' + crypto.randomBytes(8).toString('hex');

      const newUser = {
        _id,
        name: name.trim(),
        email: emailLower,
        password: hashedPassword,
        isPremium: false,
        createdAt: new Date().toISOString()
      };

      USERS_STORE.push(newUser);
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');

      // Generate a session token
      const token = 'token_' + crypto.randomBytes(16).toString('hex');
      ACTIVE_SESSIONS[token] = { _id, email: emailLower, name: newUser.name };

      res.status(201).json({
        success: true,
        message: 'Registration successful!',
        token,
        user: {
          _id,
          name: newUser.name,
          email: newUser.email,
          isPremium: newUser.isPremium
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Server registration error: ' + err.message });
    }
  });

  // 2. Login User
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const emailLower = email.toLowerCase().trim();
      const user = USERS_STORE.find(u => u.email.toLowerCase() === emailLower);
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }

      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      if (user.password !== hashedPassword) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }

      // Check premium expiry
      if (user.isPremium && user.premiumUntil) {
        const expiry = new Date(user.premiumUntil);
        if (expiry < new Date()) {
          user.isPremium = false;
          fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');
        }
      }

      const token = 'token_' + crypto.randomBytes(16).toString('hex');
      ACTIVE_SESSIONS[token] = { _id: user._id, email: emailLower, name: user.name };

      res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          premiumUntil: user.premiumUntil
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Server login error: ' + err.message });
    }
  });

  // 3. Google Federated Sign-In (Saves / registers user on fly)
  app.post('/api/auth/google', (req, res) => {
    try {
      const { name, email, photoURL, uid } = req.body;

      if (!email || !name) {
        return res.status(400).json({ success: false, message: 'Google profile credentials missing.' });
      }

      const emailLower = email.toLowerCase().trim();
      let user = USERS_STORE.find(u => u.email.toLowerCase() === emailLower);

      if (!user) {
        const _id = uid || 'user_' + crypto.randomBytes(8).toString('hex');
        user = {
          _id,
          name: name.trim(),
          email: emailLower,
          photoURL: photoURL || '',
          isPremium: false,
          createdAt: new Date().toISOString()
        };
        USERS_STORE.push(user);
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');
      } else {
        // Update user properties if changed
        let modified = false;
        if (photoURL && user.photoURL !== photoURL) {
          user.photoURL = photoURL;
          modified = true;
        }
        if (uid && user._id !== uid && user._id.startsWith('user_')) {
          user._id = uid;
          modified = true;
        }
        if (modified) {
          fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');
        }
      }

      // Check premium expiry
      if (user.isPremium && user.premiumUntil) {
        const expiry = new Date(user.premiumUntil);
        if (expiry < new Date()) {
          user.isPremium = false;
          fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');
        }
      }

      const token = 'token_' + crypto.randomBytes(16).toString('hex');
      ACTIVE_SESSIONS[token] = { _id: user._id, email: emailLower, name: user.name };

      res.json({
        success: true,
        message: 'Google login successful!',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          isPremium: user.isPremium,
          purchaseDate: user.purchaseDate,
          premiumUntil: user.premiumUntil
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Google login error: ' + err.message });
    }
  });

  // 4. Get current user profile
  app.get('/api/auth/me', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
      }

      const token = authHeader.split(' ')[1];
      const session = ACTIVE_SESSIONS[token];

      if (!session) {
        return res.status(401).json({ success: false, message: 'Session expired or invalid' });
      }

      const user = USERS_STORE.find(u => u._id === session._id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Check premium expiry
      if (user.isPremium && user.premiumUntil) {
        const expiry = new Date(user.premiumUntil);
        if (expiry < new Date()) {
          user.isPremium = false;
          fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');
        }
      }

      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          isPremium: user.isPremium,
          purchaseDate: user.purchaseDate,
          premiumUntil: user.premiumUntil
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Profile retrieval error: ' + err.message });
    }
  });

  // ==========================================
  // RAZORPAY SUBSCRIPTION SYSTEM API ROUTES
  // ==========================================

  // 1. Create Razorpay Subscription Order
  app.post('/api/subscribe/create-order', (req, res) => {
    try {
      const { amount, currency = 'INR' } = req.body;
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      // Handle demo mode fallback if Razorpay keys are not set yet
      if (!keyId || !keySecret) {
        const mockOrderId = 'order_mock_' + crypto.randomBytes(8).toString('hex');
        return res.json({
          success: true,
          isDemo: true,
          orderId: mockOrderId,
          amount: amount || 900,
          currency,
          key: 'rzp_test_mockkey'
        });
      }

      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });

      const options = {
        amount: amount || 900, // Amount in paise (₹9 = 900 paise)
        currency,
        receipt: 'receipt_pro_' + Date.now()
      };

      razorpay.orders.create(options, (err, order) => {
        if (err) {
          console.error('Razorpay order creation error:', err);
          return res.status(500).json({ success: false, message: 'Razorpay Order Creation Failed: ' + (err as any).message });
        }
        res.json({
          success: true,
          isDemo: false,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          key: keyId
        });
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Server subscription order creation exception: ' + err.message });
    }
  });

  // 2. Verify Razorpay Payment Signature and activate Pro Status
  app.post('/api/subscribe/verify-payment', (req, res) => {
    try {
      const { orderId, paymentId, signature, email, isDemo } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, message: 'User email is required to activate subscription.' });
      }

      const user = USERS_STORE.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ success: false, message: 'Registered user not found matching this email.' });
      }

      if (isDemo) {
        // Safe mock verification
        const now = new Date();
        user.isPremium = true;
        user.purchaseDate = now.toISOString();
        user.premiumUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30-day Pro status
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');

        return res.json({
          success: true,
          message: 'SmartCook Pro Activated Successfully (Demo Mode Verified)!',
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            photoURL: user.photoURL,
            isPremium: user.isPremium,
            purchaseDate: user.purchaseDate,
            premiumUntil: user.premiumUntil
          }
        });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ success: false, message: 'Razorpay secret key not configured on server.' });
      }

      // Compute HMAC SHA256 signature verification
      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature === signature) {
        const now = new Date();
        user.isPremium = true;
        user.purchaseDate = now.toISOString();
        user.premiumUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days of Pro status
        fs.writeFileSync(USERS_DB_PATH, JSON.stringify(USERS_STORE, null, 2), 'utf-8');

        res.json({
          success: true,
          message: 'SmartCook Pro Activated Successfully (Signature Verified)!',
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            photoURL: user.photoURL,
            isPremium: user.isPremium,
            purchaseDate: user.purchaseDate,
            premiumUntil: user.premiumUntil
          }
        });
      } else {
        res.status(400).json({ success: false, message: 'Payment verification failed: Invalid Signature.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Server signature verification error: ' + err.message });
    }
  });

  // ADMIN API ROUTES
  // 1. Verify password
  app.post('/api/admin/verify', (req, res) => {
    try {
      const { password } = req.body;
      if (password === 'admin123') {
        res.json({ success: true, message: 'Authentication successful' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid admin credentials' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Server authentication exception' });
    }
  });

  // 2. Create single recipe
  app.post('/api/admin/recipe', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer admin123') {
        return res.status(403).json({ success: false, message: 'Unauthorized access. Invalid auth token.' });
      }

      const { title, category, difficulty, servings_base, total_time_minutes, ingredients, steps, cover_image, description } = req.body;

      if (!title || !category || !ingredients || !ingredients.length || !steps || !steps.length) {
        return res.status(400).json({ success: false, message: "Critical recipe payload fields are missing." });
      }

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const _id = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

      const newRecipe = {
        _id,
        title,
        slug,
        category,
        difficulty: difficulty || 'Easy',
        servings_base: Number(servings_base) || 2,
        total_time_minutes: Number(total_time_minutes) || 15,
        cover_image: cover_image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800',
        description: description || '',
        ingredients: ingredients || [],
        steps: steps || [],
        rating: 4.5 + Math.round(Math.random() * 5) / 10,
        reviews_count: Math.floor(Math.random() * 45) + 5
      };

      RECIPES_STORE.unshift(newRecipe);
      fs.writeFileSync(DB_PATH, JSON.stringify(RECIPES_STORE, null, 2), 'utf-8');

      return res.status(201).json({
        success: true,
        message: "Recipe indexed into secure database clusters successfully!",
        data: newRecipe
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Database Allocation Core Exception: " + error.message });
    }
  });

  // 3. Bulk upload recipes
  app.post('/api/admin/bulk-upload', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer admin123') {
        return res.status(403).json({ success: false, message: 'Unauthorized access. Invalid auth token.' });
      }

      const { recipes } = req.body;
      if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
        return res.status(400).json({ success: false, message: "Payload must contain an array of recipes." });
      }

      const addedRecipes: any[] = [];
      recipes.forEach((item: any) => {
        if (!item.title || !item.category) return;

        const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const _id = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

        const newRecipe = {
          _id,
          title: item.title,
          slug,
          category: item.category,
          difficulty: item.difficulty || 'Easy',
          servings_base: Number(item.servings_base) || 2,
          total_time_minutes: Number(item.total_time_minutes) || 15,
          cover_image: item.cover_image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&q=80&w=800',
          description: item.description || '',
          ingredients: item.ingredients || [],
          steps: item.steps || [],
          rating: item.rating || (4.5 + Math.round(Math.random() * 5) / 10),
          reviews_count: item.reviews_count || (Math.floor(Math.random() * 45) + 5)
        };

        RECIPES_STORE.unshift(newRecipe);
        addedRecipes.push(newRecipe);
      });

      fs.writeFileSync(DB_PATH, JSON.stringify(RECIPES_STORE, null, 2), 'utf-8');

      return res.status(201).json({
        success: true,
        message: `${addedRecipes.length} recipes indexed into database successfully!`,
        count: addedRecipes.length
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: "Database Allocation Core Exception: " + error.message });
    }
  });

  // 4. Delete recipe
  app.delete('/api/admin/recipes/:id', (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer admin123') {
        return res.status(403).json({ success: false, message: 'Unauthorized access.' });
      }

      const { id } = req.params;
      const index = RECIPES_STORE.findIndex(r => r._id === id);
      if (index === -1) {
        return res.status(404).json({ success: false, message: "Recipe not found." });
      }

      RECIPES_STORE.splice(index, 1);
      fs.writeFileSync(DB_PATH, JSON.stringify(RECIPES_STORE, null, 2), 'utf-8');

      return res.json({ success: true, message: "Recipe deleted successfully." });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Serve Frontend
  if (process.env.NODE_ENV === 'production') {
    // In production, serve built static assets from dist
    app.use(express.static(path.join(currentDirname, 'dist')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(currentDirname, 'dist', 'index.html'));
    });
  } else {
    // In development, create and use Vite dev server middleware
    console.log('Starting Vite in development middleware mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SmartCook server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
