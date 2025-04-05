const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const session = require('express-session');
const path = require('path');
const app = express();


const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'pokemon_secret',
  resave: false,
  saveUninitialized: true
}));


app.get('/', (req, res) => res.redirect('/signin'));


app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  await db.collection('users').doc(email).set({ name, password, history: [] });
  res.redirect('/signin');
});


app.get('/signin', (req, res) => res.render('signin'));
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  const doc = await db.collection('users').doc(email).get();
  if (!doc.exists || doc.data().password !== password) {
    return res.send('Invalid credentials');
  }
  req.session.user = { email, name: doc.data().name };
  res.redirect('/profile');
});


app.get('/profile', async (req, res) => {
  if (!req.session.user) return res.redirect('/signin');
  const doc = await db.collection('users').doc(req.session.user.email).get();
  res.render('profile', { name: doc.data().name, history: doc.data().history });
});


app.get('/search', (req, res) => {
  if (!req.session.user) return res.redirect('/signin');
  res.render('search', { result: null });
});

app.post('/search', async (req, res) => {
  const pokemon = req.body.pokemon.toLowerCase();
  const fetch = require('node-fetch');
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
  if (!response.ok) return res.send('Pokémon not found');
  const data = await response.json();

  const result = {
    name: data.name,
    height: data.height,
    weight: data.weight,
    abilities: data.abilities.map(a => a.ability.name),
    types: data.types.map(t => t.type.name)
  };

  const userRef = db.collection('users').doc(req.session.user.email);
  const doc = await userRef.get();
  const updatedHistory = doc.data().history || [];
  updatedHistory.unshift(result);
  await userRef.update({ history: updatedHistory });

  res.render('search', { result });
});


app.get('/signout', (req, res) => {
  req.session.destroy();
  res.redirect('/signin');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
