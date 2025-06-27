    const { Telegraf, Markup } = require('telegraf');
    const dotenv = require('dotenv');
    const express = require('express');
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const fs = require('fs');
    const { Parser } = require('json2csv');

    dotenv.config();

    const bot = new Telegraf(process.env.BOT_TOKEN);
    const ADMIN_CHAT_IDS = [process.env.ADMIN_CHAT_ID];
    const DANA_QR_LINK = 'https://files.catbox.moe/mxovdq.jpg';

    const PAYMENT_TIMEOUT = 1 * 60 * 60 * 1000;    
    const REMINDER_TIMEOUT = 30 * 60 * 1000;        

    const db = new sqlite3.Database('./users.db');
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        paket TEXT,
        timestamp INTEGER,
        status TEXT,
        expired_at INTEGER,
        kicked INTEGER DEFAULT 0
      )`, (err) => {
        if (err) console.error('Error creating orders table:', err.message);
      });
    });


    const paketList = {
      lokal: {
        name: "Lokal",
        harga: 2000,
        channel: 'https://t.me/+05D0N_SWsMNkMTY1'
      },
      cina: {
        name: "Cina",
        harga: 2000,
        channel: 'https://t.me/+D0o3LkSFhLAxZGQ1'
      },
      asia: {
        name: "Asia",
        harga: 2000,
        channel: 'https://t.me/+PyUHdR0yAkQ2NDBl'
      },
      amerika: {
        name: "Amerika",
        harga: 2000,
        channel: 'https://t.me/+p_5vP8ACzUs1MTNl'
      },
      yaoi: {
        name: "Yaoi",
        harga: 2000,
        channel: 'https://t.me/+Bs212qTHcRZkOTg9'
      },
      lengkap: {
        name: "Paket Lengkap",
        harga: 8000,
        channel: [
          'https://t.me/+05D0N_SWsMNkMTY1',
          'https://t.me/+D0o3LkSFhLAxZGQ1',
          'https://t.me/+PyUHdR0yAkQ2NDBl',
          'https://t.me/+p_5vP8ACzUs1MTNl',
          'https://t.me/+Bs212qTHcRZkOTg9'
        ]
      }
    };

    function showMainMenu(ctx) {
      ctx.reply(
        `👋 Selamat datang di BOT VIP by. @ujoyp!\n\nPilih paket yang kamu inginkan:\n` +
        `📦 Lokal - Rp2.000\n📦 Cina - Rp2.000\n📦 Asia - Rp2.000\n` +
        `📦 Amerika - Rp2.000\n📦 Yaoi - Rp2.000\n📦 Paket Lengkap - Rp8.000`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Lokal', 'lokal')],
          [Markup.button.callback('Cina', 'cina')],
          [Markup.button.callback('Asia', 'asia')],
          [Markup.button.callback('Amerika', 'amerika')],
          [Markup.button.callback('Yaoi', 'yaoi')],
          [Markup.button.callback('🔥 Paket Lengkap', 'lengkap')],
        ])
      );
    }


    bot.start((ctx) => {
      showMainMenu(ctx);
    });

    bot.action(/^(lokal|cina|asia|amerika|yaoi|lengkap)$/, (ctx) => {
      const paketId = ctx.match[0];
      const userId = ctx.from.id;
      const now = Date.now();

      db.get(`SELECT paket, status FROM orders WHERE user_id = ? AND status = 'pending'`, [userId], (err, row) => {
        if (row) {
          const pkg = paketList[row.paket];
          ctx.answerCbQuery();
          return ctx.reply(
            `⚠️ Kamu masih memiliki transaksi *${pkg.name}* yang belum selesai.\nSilakan lanjutkan bayar atau ketik /batal`,
            {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✅ Lanjutkan Pembayaran', 'continue_payment')],
                [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
              ])
            }
          );
        }

        db.run(`INSERT INTO orders (user_id, paket, timestamp, status) VALUES (?, ?, ?, ?)`, [userId, paketId, now, 'pending']);
      db.run(`INSERT INTO users (id, paket, status) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET paket=excluded.paket, status=excluded.status`,
          [userId, paketId, 'pending']);
        const username = ctx.from.username || ctx.from.first_name || 'Pengguna';
        const pkg = paketList[paketId];
      ADMIN_CHAT_IDS.forEach(adminId => {
        bot.telegram.sendMessage(adminId, `🛒 Order baru dari @${username} untuk paket *${pkg.name}*`, {
        parse_mode: 'Markdown'
        });
    });

        
        let caption = `📦 *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\n` +
                      `Silakan scan QRIS diatas untuk melanjutkan transaksi.\n\n` +
                      `Setelah bayar, kirim bukti foto/ss hasil transaksi.\n\n` +
                      `Butuh bantuan❓ Chat admin @ujoyp`;

        ctx.replyWithPhoto(DANA_QR_LINK, {
          caption,
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url('📞 Hubungi Admin', 'https://t.me/ujoyp')],
            [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
          ])
        });


        setTimeout(() => {
          db.get(`SELECT status FROM users WHERE id = ?`, [userId], (e, r) => {
            if (r && r.status === 'pending') {
              ctx.telegram.sendMessage(userId, `⏰ Pengingat! Kamu masih memiliki pembayaran paket *${pkg.name}*.`, {
                parse_mode: 'Markdown'
              });
            }
          });
        }, REMINDER_TIMEOUT);

      
        setTimeout(() => {
          db.get(`SELECT status FROM users WHERE id = ?`, [userId], (e, r) => {
            if (r && r.status === 'pending') {
              db.run(`DELETE FROM users WHERE id = ?`, [userId]);
              ctx.telegram.sendMessage(userId, `⏰ Waktu pembayaran habis. Silakan ulangi pembelian.`, {
                reply_markup: Markup.inlineKeyboard([
                  [Markup.button.callback('🔁 Kembali ke Menu', 'back_to_menu')]
                ])
              });
            }
          });
        }, PAYMENT_TIMEOUT);
      });
    });


    bot.action('continue_payment', (ctx) => {
      const userId = ctx.from.id;
      db.get(`SELECT paket FROM users WHERE id = ? AND status = 'pending'`, [userId], (err, row) => {
        if (!row) return ctx.reply('❌ Tidak ada transaksi yang tertunda.');
        const pkg = paketList[row.paket];
        ctx.replyWithPhoto(DANA_QR_LINK, {
          caption: `📦 *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\nSilakan lanjutkan pembayaran via DANA ke:\n📱 *${DANA_NUMBER}*`,
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.url('📞 Hubungi Admin', 'https://t.me/ujoyp')],
            [Markup.button.callback('❌ Batalkan Pesanan', 'cancel_order')]
          ])
        });
        ctx.answerCbQuery();
      });
    });

    bot.action('menu_perpanjang', (ctx) => {
      const buttons = Object.keys(paketList).map(paketId => {
        const pkg = paketList[paketId];
        return Markup.button.callback(`Perpanjang ${pkg.name}`, `perpanjang_${paketId}`);
      });

      ctx.reply('🔄 Pilih paket yang ingin diperpanjang:', Markup.inlineKeyboard(
        buttons.map(btn => [btn]) 
      ));

      ctx.answerCbQuery();
    });


    bot.action(/^perpanjang_(.+)$/, (ctx) => {
      const paketId = ctx.match[1].toLowerCase();
      const pkg = paketList[paketId];
      const userId = ctx.from.id;
      const now = Date.now();

      if (!pkg) return ctx.reply('❌ Paket tidak ditemukan.');

      db.run(`INSERT INTO orders (user_id, paket, timestamp, status) VALUES (?, ?, ?, ?)`, [userId, paketId, now, 'pending']);
      db.run(`INSERT OR REPLACE INTO users (id, paket, status) VALUES (?, ?, ?)`, [userId, paketId, 'pending']);

    ctx.replyWithPhoto(DANA_QR_LINK, {
      caption: `🔄 Perpanjang *${pkg.name}* – Rp${pkg.harga.toLocaleString('id-ID')}\n\n` +
        `Silakan bayar DANA ke:\n📱 *${DANA_NUMBER}*\n` +
        `Lalu kirim bukti pembayaran seperti biasa.`,
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url('💬 Chat Admin', 'https://t.me/ujoyp')],
        [Markup.button.callback('📦 Lihat Paket', 'back_to_menu')]
      ])
    });
    });

    bot.action('cancel_order', (ctx) => {
      const userId = ctx.from.id;

      db.get(`SELECT * FROM orders WHERE user_id = ? AND status = 'pending'`, [userId], (err, row) => {
        if (!row) {
          return ctx.answerCbQuery('❌ Tidak ada pesanan yang bisa dibatalkan.', { show_alert: true });
        }

        db.run(`DELETE FROM orders WHERE user_id = ? AND status = 'pending'`, [userId]);

        ctx.answerCbQuery('✅ Pesanan dibatalkan.');
        ctx.reply('❌ Pesanan kamu sudah dibatalkan.\n\nKembali ke menu utama:', Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
        ]));
      });
    });

    bot.action('back_to_menu', (ctx) => {
      showMainMenu(ctx);
      ctx.answerCbQuery();
    });

    bot.on(['photo', 'document'], (ctx) => {
      const userId = ctx.from.id;
      const firstName = ctx.from.first_name || 'Tanpa Nama';
      const username = ctx.from.username
        ? `@${ctx.from.username}`
        : `[${firstName}](tg://user?id=${userId})`;

      const userCaption = ctx.message.caption || '(tidak ada catatan)';
      
      db.get(`SELECT paket, status FROM users WHERE id = ?`, [userId], (err, row) => {
        if (!row) return ctx.reply('❌ Kamu belum memilih paket.');
        
        if (row.status === 'waiting_review') {
          return ctx.reply('📨 Bukti pembayaran kamu sedang direview admin. Mohon tunggu ya.');
        }

        let fileId, fileType;
        if (ctx.message.photo) {
          fileId = ctx.message.photo.slice(-1)[0].file_id;
          fileType = 'photo';
        } else if (ctx.message.document) {
          fileId = ctx.message.document.file_id;
          fileType = 'document';
        } else {
          return ctx.reply('❌ Bukti pembayaran tidak valid.');
        }

        db.run(`UPDATE users SET status = 'waiting_review' WHERE id = ?`, [userId]);

        const waktu = new Date().toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const captionText =
            `📥 Bukti pembayaran dari ${username}\n` +
            `🆔 ID: \`${userId}\`\n` +
            `📦 Paket: *${row.paket}*\n` +
            `🕒 Tanggal: *${waktu}*\n\n` +
            `📝 Catatan: ${userCaption}`;


        ADMIN_CHAT_IDS.forEach(adminId => {
          const sendOptions = {
            caption: captionText,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [Markup.button.callback('✅ Approve', `approve_${userId}`)],
                [Markup.button.callback('❌ Tolak', `reject_${userId}`)]
              ]
            }
          };

          if (fileType === 'photo') {
            ctx.telegram.sendPhoto(adminId, fileId, sendOptions);
          } else {
            ctx.telegram.sendDocument(adminId, fileId, sendOptions);
          }
        });

        ctx.reply('📩 Bukti pembayaran berhasil dikirim ke admin. Tunggu konfirmasi ya.');
      });
    });

    bot.action('some_callback_data', async (ctx) => {
      await ctx.editMessageText('Ini menu baru');
      try {
        await ctx.answerCbQuery();
      } catch (err) {
        console.warn('Callback query sudah kedaluwarsa atau error:', err.message);
      }
    });

    bot.action(/approve_(\d+)/, (ctx) => {
      const userId = Number(ctx.match[1]);

      db.get(`SELECT paket FROM users WHERE id = ?`, [userId], (err, userRow) => {
        if (!userRow) return ctx.reply('❌ Data user tidak ditemukan.');

        const pkg = paketList[userRow.paket];
        const now = Date.now();

        db.get(
          `SELECT expired_at FROM orders WHERE user_id = ? AND status = 'approved' ORDER BY expired_at DESC LIMIT 1`,
          [userId],
          (err, orderRow) => {
            const baseTime = (orderRow && orderRow.expired_at > now) ? orderRow.expired_at : now;
            const newExpiredAt = baseTime + 30 * 24 * 60 * 60 * 1000;
            const expireTimeStr = new Date(newExpiredAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });



          
            db.run(
              `INSERT INTO orders (user_id, paket, timestamp, status, expired_at) VALUES (?, ?, ?, 'approved', ?)`,
              [userId, userRow.paket, now, newExpiredAt]
            );
            db.run(`UPDATE users SET status = 'approved' WHERE id = ?`, [userId]);

            ctx.editMessageReplyMarkup({ inline_keyboard: [[Markup.button.callback('✅ Sudah di‑approve', 'noop')]] });

            bot.telegram.sendMessage(userId,
              `✅ Pembayaran *${pkg.name}* sudah di‑approve!\n` +
              `⏳ Berlaku sampai: *1 bulan*\n\n` +
              `Klik tombol di bawah untuk masuk ke channel:`,
              {
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    ...(Array.isArray(pkg.channel)
                      ? pkg.channel.map(url => [Markup.button.url('📺 Masuk Channel', url)])
                      : [[Markup.button.url('📺 Masuk Channel', pkg.channel)]]),
                    [Markup.button.callback('🔁 Kembali ke Menu', 'back_to_menu')]
                  ]
                }
              }
            );
            ctx.answerCbQuery('✅ Approved');
          }
        );
      });
    });

    bot.action(/reject_(\d+)/, (ctx) => {
      const userId = Number(ctx.match[1]);
      db.run(`DELETE FROM users WHERE id = ?`, [userId], () => {
        bot.telegram.sendMessage(userId, '❌ Maaf, bukti pembayaran tidak valid. Klik /batal untuk mulai ulang.');
        ctx.editMessageReplyMarkup({ inline_keyboard: [[Markup.button.callback('❌ Sudah Ditolak', 'noop')]] });
        ctx.answerCbQuery();
      });
    });

    bot.command('status', (ctx) => {
      const userId = ctx.from.id;
      db.all(
        `SELECT paket, status, timestamp, expired_at FROM orders WHERE user_id = ? ORDER BY timestamp DESC`,
        [userId],
        (err, rows) => {
          if (!rows || rows.length === 0) return ctx.reply('❌ Kamu belum melakukan pemesanan.');

          const now = Date.now();
          let text = '📦 *Status Pemesanan Kamu:*\n\n';

          rows.forEach((r, i) => {
            const pkg = paketList[r.paket];
            const ts = new Date(r.timestamp).toLocaleString('id-ID');
            const exp = r.expired_at ? new Date(r.expired_at).toLocaleString('id-ID') : '-';
            const isExpired = r.expired_at && r.expired_at < now;

            text += `#${i + 1}\n📦 *${pkg.name}*\n📊 ${r.status}\n🕓 ${ts}\n⏳ Expired: ${exp}`;
            if (r.status === 'approved' && !isExpired) {
              if (Array.isArray(pkg.channel)) {
                pkg.channel.forEach((link, j) => {
                  text += `\n🔗 [Channel ${j + 1}](${link})`;
                });
              } else {
                text += `\n🔗 [Masuk Channel](${pkg.channel})`;
              }
            }
            text += '\n\n';
          });

          ctx.reply(text, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: Markup.inlineKeyboard([[Markup.button.callback('🛍️ Beli Lagi', 'back_to_menu')]])
          });
        }
      );
    });


    bot.command('broadcast', async (ctx) => {
      const isAdmin = ADMIN_CHAT_IDS.includes(ctx.chat.id.toString());
      if (!isAdmin) return ctx.reply('❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.');

      const message = ctx.message.text.split(' ').slice(1).join(' ');
      if (!message) {
        return ctx.reply('❗ Format salah. Contoh: `/broadcast Pesan penting untuk semua pengguna`', {
          parse_mode: 'Markdown'
        });
      }

      db.all(`SELECT DISTINCT user_id FROM orders`, async (err, users) => {
        if (err || users.length === 0) {
          return ctx.reply('❌ Gagal mengambil daftar pengguna atau belum ada pengguna.');
        }

        let success = 0, failed = 0;
        for (const { user_id } of users) {
          try {
            await bot.telegram.sendMessage(user_id, `📢 *Broadcast dari Admin:*\n\n${message}`, {
              parse_mode: 'Markdown'
            });
            success++;
          } catch (error) {
            failed++;
            console.warn(`Gagal kirim ke ${user_id}:`, error.message);
          }
        }

        ctx.reply(`✅ Broadcast selesai.\n📤 Berhasil: ${success}\n❌ Gagal: ${failed}`);
      });
    });


    bot.command('export', (ctx) => {
      if (!ADMIN_CHAT_IDS.includes(ctx.chat.id.toString())) {
        return ctx.reply('❌ Kamu tidak punya akses ke perintah ini.');
      }

      db.all(`SELECT * FROM orders`, [], (err, rows) => {
        if (err || rows.length === 0) {
          return ctx.reply('❌ Gagal mengambil data atau data kosong.');
        }

        try {
          const fields = ['id', 'user_id', 'paket', 'timestamp', 'status', 'expired_at', 'kicked'];
          const opts = { fields };
          const parser = new Parser(opts);
          const csv = parser.parse(rows);

          const filePath = path.join(__dirname, 'orders_export.csv');
          fs.writeFileSync(filePath, csv);

          ctx.replyWithDocument({ source: filePath, filename: 'orders_export.csv' });
        } catch (e) {
          console.error(e);
          ctx.reply('❌ Gagal mengekspor data.');
        }
      });
    });

    bot.command('tendang', (ctx) => {
    if (!ADMIN_CHAT_IDS.includes(ctx.chat.id.toString())) {
        return ctx.reply('❌ Kamu tidak punya akses ke perintah ini.');
      }
      const now = Date.now();
      db.all(
        `SELECT user_id, expired_at FROM orders
        WHERE status = 'approved' AND expired_at < ? AND kicked = 0
        GROUP BY user_id`,
        [now],
        async (err, rows) => {
          if (err) {
            console.error('DB error:', err);
            return ctx.reply('❌ Terjadi kesalahan saat memeriksa data.');
          }

          if (!rows.length) return ctx.reply('✅ Tidak ada pengguna expired.');

          for (const { user_id, expired_at } of rows) {
            const user = await bot.telegram.getChat(user_id).catch(() => null);
            const username = user?.username ? `@${user.username}` : user?.first_name || '––';
            const expiredStr = new Date(expired_at).toLocaleString('id-ID');

            await ctx.reply(
              `🧾 User Expired:\n🆔 ${user_id}\n👤 ${username}\n📅 Expired: ${expiredStr}`,
              Markup.inlineKeyboard([[Markup.button.callback('🚫 Tendang', `tendang_manual_${user_id}`)]])
            );
          }
        }
      );
    });

    bot.command('batal', (ctx) => {
      const userId = ctx.from.id;

      db.get(`SELECT * FROM orders WHERE user_id = ? AND status = 'pending'`, [userId], (err, row) => {
        if (!row) {
          return ctx.reply('❌ Tidak ada pesanan yang bisa dibatalkan.');
        }

        db.run(`DELETE FROM orders WHERE user_id = ? AND status = 'pending'`, [userId]);
        ctx.reply('✅ Pesanan kamu sudah dibatalkan.\n\nKembali ke menu utama:', Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
        ]));
      });
    });

    bot.action(/^tendang_manual_(\d+)$/, async (ctx) => {
      const userId = ctx.match[1];

      db.get(`SELECT expired_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId], async (err, row) => {
        if (err || !row) {
          console.error(err);
          return ctx.answerCbQuery('❌ Gagal mengambil data user');
        }

        const expiredDate = new Date(row.expired_at).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        try {
          const userInfo = await bot.telegram.getChat(userId);
          const username = userInfo.username ? `@${userInfo.username}` : (userInfo.first_name || 'Tanpa Nama');

          await bot.telegram.sendMessage(userId, '⛔️ Akses kamu ke channel sudah dicabut oleh admin. Silahkan lakukan perpanjangan/berhenti berlangganan');
          db.run(`DELETE FROM users WHERE id = ?`, [userId]);
          db.run(`UPDATE orders SET kicked = 1 WHERE user_id = ?`, [userId]);

          ctx.answerCbQuery('✅ User ditandai ditendang');
          ctx.reply(`✅ User ${username} (ID: ${userId}) sudah ditandai sebagai ditendang.\n📅 Expired: ${expiredDate}`);
        } catch (error) {
          console.error(error);
          ctx.answerCbQuery('❌ Gagal mendapatkan info user');
        }
      });
    });


    bot.command('help', (ctx) => {
      const helpMessage = `
    ❓ *Pusat Bantuan / FAQ*

    🔹 *Cara Pembayaran:*
    1. Pilih paket dari menu utama
    2. Kirim bukti bayar via DANA ke: 
      📱 087883536039
    3. Upload bukti ke bot
    4. Tunggu verifikasi dari admin

    🔹 *Cek Status:*
    Ketik perintah /status untuk melihat status pemesanan dan masa aktif.

    🔹 *Daftar Paket:*
    Ketik perintah /start atau klik tombol di bawah untuk melihat paket.

    🔹 *Batal Pemesanan:*
    Ketik /batal jika ingin membatalkan pesanan yang belum dibayar.

    🔹 *Hubungi Admin:*
    👉 @ujoyp
    `;

      ctx.replyWithMarkdown(helpMessage, Markup.inlineKeyboard([
        [Markup.button.url('💬 Chat Admin', 'https://t.me/ujoyp')],
        [Markup.button.callback('📦 Lihat Paket', 'back_to_menu')]
      ]));
    });


    bot.on('message', (ctx) => {
      const msg = ctx.message;


      if (msg.photo || msg.document) return;

      const unsupportedTypes = [
        'sticker',
        'voice',
        'video',
        'audio',
        'contact',
        'location',
        'video_note',
        'animation'
      ];

      for (const type of unsupportedTypes) {
        if (msg[type]) {
          ctx.reply('⚠️ Maaf, jenis pesan ini tidak didukung.\nSilakan gunakan tombol menu di bawah:');
          return showMainMenu(ctx);
        }
      }


      const allowedCommands = ['/start', '/status', '/batal', '/broadcast', '/export', '/tendang', '/daftar'];
      if (msg.text && !allowedCommands.includes(msg.text)) {
        ctx.reply('❓ Maaf, perintah tidak dikenali. Silakan pilih dari menu di bawah:');
        return showMainMenu(ctx);
      }
    });

    const app = express();
    app.get('/', (_, res) => res.send('🤖 Bot aktif'));
    app.listen(3000, () => console.log('✅ Web server aktif di port 3000'));

    async function startBot() {
      try {
        await bot.telegram.deleteWebhook();
        await bot.launch();
        console.log('🤖 Bot berjalan dengan polling...');
      } catch (err) {
        console.error('❌ Gagal menjalankan bot:', err);
      }
    }

    startBot();
    
