const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./backend-server/user.db'); // Koneksi ke user.db

// Middleware
app.use(bodyParser.json(), express.json());
app.use(cors());

const ip = '192.168.1.30'; // IP statis yang dikonfigurasi
const PORT = 3000;

// Buat tabel jika belum ada
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profile_picture TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image_url TEXT NOT NULL,
    deskripsi TEXT,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// Endpoint Register
app.post('/register', async (req, res) => {
  const { nama, email, password } = req.body;

  if (!nama || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (nama, email, password) VALUES (?, ?, ?)`,
      [nama, email, hashedPassword],
      function (err) {
        if (err) {
          console.error('Register Error:', err);
          return res.status(400).json({ error: 'User already exists or invalid data' });
        }

        res.json({ message: 'Registration successful!' });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Endpoint Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      console.error('Login Error:', err || 'User not found');
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    try {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ success: false, error: 'Invalid email or password' });
      }

      res.json({
        success: true,
        message: 'Login successful',
        userData: {
          id: user.id,
          nama: user.nama,
          profile_picture: user.profile_picture
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });
});

// Endpoint untuk mendapatkan data user berdasarkan ID
app.get('/get-user/:id', (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  db.get(`SELECT id, nama, profile_picture, alamat FROM users WHERE id = ?`, [id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      nama: user.nama,
      profile_picture: user.profile_picture,
      alamat: user.alamat,
    });
  });
});

// Endpoint untuk memperbarui URL gambar profil
app.post('/update-profile-picture', (req, res) => {
  const { id, profile_picture_url } = req.body;

  if (!id || !profile_picture_url) {
    return res.status(400).json({ error: 'User ID and profile picture URL are required' });
  }

  db.run(
    `UPDATE users SET profile_picture = ? WHERE id = ?`,
    [profile_picture_url, id],
    function (err) {
      if (err) {
        console.error('Error updating profile picture:', err);
        return res.status(500).json({ error: 'Failed to update profile picture' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Profile picture updated successfully!' });
    }
  );
});

// Endpoint Menampilkan Toko
app.get('/produk-by-user/:user_id', (req, res) => {
  const userId = req.params.user_id;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  const userCheckQuery = 'SELECT * FROM users WHERE id = ?';
  db.get(userCheckQuery, [userId], (err, user) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error occurred' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const query = `
      SELECT 
        products.id AS product_id,
        products.nama_produk,
        products.harga,
        products.image_url,
        products.deskripsi,
        products.user_id,
        users.nama AS user_name,
        users.profile_picture
      FROM 
        products 
      INNER JOIN 
        users 
      ON 
        products.user_id = users.id
      WHERE 
        products.user_id = ?;
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Database query error:', err);
        return res.status(500).json({ error: 'Database error occurred' });
      }
      res.json(rows);
    });
  });
});

// Endpoint Menampilkan Produk berdasarkan user_id
app.get('/produk-by-user/:user_id', (req, res) => {
  const userId = req.params.user_id;

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user_id' });
  }

  const userCheckQuery = 'SELECT * FROM users WHERE id = ?';
  db.get(userCheckQuery, [userId], (err, user) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'Database error occurred' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const query = `
      SELECT 
        products.id AS product_id,
        products.name AS product_name,
        products.price,
        products.image_url,
        products.deskripsi,
        products.user_id,
        users.nama AS user_name,
        users.profile_picture
      FROM 
        products 
      INNER JOIN 
        users 
      ON 
        products.user_id = users.id
      WHERE 
        products.user_id = ?;
    `;

    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Error fetching products:', err);
        return res.status(500).json({ error: 'Error fetching products' });
      }

      if (rows.length === 0) {
        return res.status(200).json({ message: 'No products found for this user' });
      }
      res.json(rows);
    });
  });
});


// Endpoint untuk menerima data checkout
app.post('/checkout', (req, res) => {
  const { userId, selectedItems, totalBayar, address } = req.body;

  if (!userId || !selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
    return res.status(400).json({ error: 'Invalid checkout data' });
  }

  if (!totalBayar || !address) {
    return res.status(400).json({ error: 'Total payment and address are required' });
  }

  const orderQuery = `
    INSERT INTO orders (user_id, total_bayar, address)
    VALUES (?, ?, ?)
  `;
  
  db.run(orderQuery, [userId, totalBayar, address], function (err) {
    if (err) {
      console.error('Error inserting order:', err);
      return res.status(500).json({ error: 'Failed to insert order' });
    }

    const orderId = this.lastID;
    
    const itemsQuery = `
      INSERT INTO order_items (order_id, product_name, product_price, quantity)
      VALUES (?, ?, ?, ?)
    `;

    selectedItems.forEach(item => {
      const quantity = item.quantity || 1; 

      db.run(itemsQuery, [orderId, item.product_name, item.total_price, quantity], (err) => {
        if (err) {
          console.error('Error inserting order item:', err);
          return res.status(500).json({ error: 'Failed to insert order items' });
        }
      });
    });

    res.status(200).json({ message: 'Order successfully created', orderId });
  });
});

app.get('/notifications/:userId', (req, res) => {
  const userId = req.params.userId;

  const query = `
    SELECT orders.id AS orderId, orders.total_bayar, orders.address, 
           order_items.product_name, order_items.product_price, 
           order_items.quantity, status_table.status
    FROM orders
    LEFT JOIN order_items ON orders.id = order_items.order_id
    CROSS JOIN (
      SELECT 'dikemas' AS status
      UNION ALL
      SELECT 'dikirim'
      UNION ALL
      SELECT 'diterima'
    ) AS status_table
    WHERE orders.user_id = ?
    ORDER BY orders.created_at DESC
  `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ error: 'Failed to fetch notifications' });
    }

    const notifications = rows.map(row => ({
      orderId: row.orderId,
      total_bayar: row.total_bayar,
      address: row.address,
      items: [{
        product_name: row.product_name,
        product_price: row.product_price,
        quantity: row.quantity,
      }],
    }));

    res.status(200).json(notifications);
  });
});



app.get('/products/:userId', (req, res) => {
  const userId = req.params.userId;

  const query = `SELECT * FROM products WHERE user_id = ?`;
  db.all(query, [userId], (err, rows) => {
      if (err) {
          return res.status(500).json({ error: err.message });
      }
      res.json(rows);
  });
});


//Endpoint Menampilkan Produk dengan Nama User
app.get('/produk', (req, res) => {
  const { kategori } = req.query; // Ambil kategori dari query
  let query = `
    SELECT 
      products.id AS product_id,
      products.nama_produk AS product_name,
      products.harga AS price,
      products.image_url,
      products.deskripsi,
      products.kategori,
      users.id AS user_id,
      users.nama AS user_name,
      users.profile_picture AS user_profile_picture
    FROM products
    JOIN users ON products.user_id = users.id
  `;

  if (kategori) {
    query += ` WHERE products.kategori = ?`; // Filter berdasarkan kategori
  }

  db.all(query, kategori ? [kategori] : [], (err, rows) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json(rows);
  });
});


//Endpoint Menambah Produk
app.post('/add-produk', (req, res) => {
  const { name, price, image_url, deskripsi, user_id, kategori } = req.body;

  if (!name || !price || !image_url || !user_id || !kategori) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run(
    `INSERT INTO products (nama_produk, harga, image_url, deskripsi, user_id, kategori) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, price, image_url, deskripsi, user_id, kategori],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to add product' });
      }
      res.json({ success: true, message: 'Product added successfully!', id: this.lastID });
    }
  );
});


// Enpoint Memperbarui Produk
app.put('/update-produk', (req, res) => {
  const { id, name, price, image_url, deskripsi } = req.body;

  if (!id || !name || !price || !image_url || !deskripsi) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.run(
    `UPDATE products SET name = ?, price = ?, image_url = ?, deskripsi =? WHERE id = ?`,
    [name, price, image_url, deskripsi, id],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update product' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ success: true, message: 'Product updated successfully!' });
    }
  );
});

// Enpoint Tambah Produk ke Keranjang
app.post('/keranjang/tambah', (req, res) => {
  const { user_id, product_id, jumlah = 1 } = req.body;

  if (!user_id || !product_id) {
    return res.status(400).json({ error: 'User ID and Product ID are required' });
  }

  const checkQuery = `SELECT id, jumlah FROM keranjang WHERE user_id = ? AND product_id = ?`;
  const updateQuery = `UPDATE keranjang SET jumlah = jumlah + ? WHERE id = ?`;
  const insertQuery = `INSERT INTO keranjang (user_id, product_id, jumlah) VALUES (?, ?, ?)`;

  db.get(checkQuery, [user_id, product_id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (row) {
      db.run(updateQuery, [jumlah, row.id], function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to update cart' });
        }
        res.json({ message: 'Cart updated successfully!' });
      });
    } else {
      db.run(insertQuery, [user_id, product_id, jumlah], function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Failed to add to cart' });
        }
        res.json({ message: 'Product added to cart successfully!' });
      });
    }
  });
});

// Endpoint Melihat Produk di Keranjang
app.get('/keranjang/:user_id', (req, res) => {
  const { user_id } = req.params;

  if (!user_id || isNaN(user_id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const query = `
    SELECT 
      keranjang.id AS cart_id,
      products.nama_produk AS product_name,
      products.harga AS price,
      products.image_url,
      keranjang.jumlah,
      keranjang.tanggal_ditambahkan,
      (keranjang.jumlah * products.harga) AS total_price
    FROM 
      keranjang
    JOIN 
      products 
    ON 
      keranjang.product_id = products.id
    WHERE 
      keranjang.user_id = ?`;

  db.all(query, [user_id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to fetch cart data.' });
    }

    if (rows.length === 0) {
      return res.status(200).json([]); 
    }

    res.status(200).json(rows);
  });
});



// Notif server berjalan
app.listen(PORT, ip, () => {
  console.log(`Server running on http://${ip}:${PORT}`);
});
