const express = require('express');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ADMIN_ID = '8897413984';
const POSTBACK_TOKEN = process.env.POSTBACK_TOKEN || 'cashf';
const ADMIN_USERNAME = 'CashFlix_Team';

const offerConfig = {
  'Waves': { installAmt: 0.1, trialAmt: 3, installBalance: false, trialBalance: true, installComment: 'Waves install', trialComment: 'Waves Signup' },
  'PolicyBazar': { installAmt: 0.1, trialAmt: 5, installBalance: false, trialBalance: true, installComment: 'PolicyBazar install', trialComment: 'PolicyBazar Register' },
  'Bharat Ryd': { installAmt: 0.1, trialAmt: 4, installBalance: false, trialBalance: true, installComment: 'BharatRdy Install', trialComment: 'BharatRdy Register' },
  'Jigri Super': { installAmt: 0.1, trialAmt: 45, installBalance: false, trialBalance: true, installComment: 'JIGRI Install', trialComment: 'JIGRI Deposit' },
  'FRIENDSHIP': { installAmt: 0.1, trialAmt: 43, installBalance: false, trialBalance: true, installComment: 'FriendShip Install', trialComment: 'FriendShip Deposit' },
  'Incred Gold': { installAmt: 0.1, trialAmt: 22, installBalance: false, trialBalance: true, installComment: 'Incred Install', trialComment: 'Incred Gold' },
  'StoryTv Fire': { installAmt: 0.1, trialAmt: 22, installBalance: false, trialBalance: true, installComment: 'StoryTv Install', trialComment: 'StoryTv Trail' }
};

const prefixMap = {
  'PolicyBazar': 'PB',
  'Waves': 'WV',
  'Bharat Ryd': 'BR',
  'Jigri Super': 'JS',
  'FRIENDSHIP': 'FR',
  'Incred Gold': 'IG',
  'StoryTv Fire': 'ST'
};

const rateLimitMap = {};
function rateLimit(ip, limit = 10, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimitMap[ip]) rateLimitMap[ip] = [];
  rateLimitMap[ip] = rateLimitMap[ip].filter(t => now - t < windowMs);
  if (rateLimitMap[ip].length >= limit) return false;
  rateLimitMap[ip].push(now);
  return true;
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function maskPhone(phone) {
  if (!phone || phone.length < 8) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-4);
}

function getTime() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }).replace(',', '');
}

function getRequestId() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function isValidUPI(upi) {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upi);
}

function isValidIFSC(ifsc) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

function sanitize(text) {
  if (!text) return '';
  return String(text).replace(/[<>]/g, '').trim().slice(0, 500);
}

function generateReferCode(offer_name) {
  const prefix = prefixMap[offer_name] || 'CF';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = prefix;
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function sendMsg(chat_id, text, keyboard) {
  const body = { chat_id, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { keyboard, resize_keyboard: true };
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        return data.result?.message_id;
      }
    } catch(e) {
      if (i === 2) console.error('sendMsg failed:', e);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function editMsg(chat_id, message_id, text, inline_keyboard) {
  try {
    const body = { chat_id, message_id, text, parse_mode: 'HTML' };
    if (inline_keyboard !== undefined) body.reply_markup = { inline_keyboard };
    await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch(e) {}
}

async function sendInlineMsg(chat_id, text, inline_keyboard) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', reply_markup: { inline_keyboard } })
      });
      if (res.ok) {
        const data = await res.json();
        return data.result?.message_id;
      }
    } catch(e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function deleteMsg(chat_id, message_id) {
  try {
    await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, message_id })
    });
  } catch(e) {}
}

async function answerAlert(callback_query_id, text) {
  await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id, text, show_alert: text ? true : false })
  });
}

async function dbGet(table, filter) {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return res.json();
}

async function dbPost(table, data) {
  await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(data)
  });
}

async function dbPatch(table, filter, data) {
  await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

const mainKeyboard = [['💰 Withdraw', '👤 Profile']];
const contactKeyboard = {
  keyboard: [[{ text: '📱 Share Contact', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
};
const userState = {};

setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimitMap) {
    rateLimitMap[ip] = rateLimitMap[ip].filter(t => now - t < 60000);
    if (rateLimitMap[ip].length === 0) delete rateLimitMap[ip];
  }
  for (const chat_id in userState) {
    if (userState[chat_id]?.timestamp && now - userState[chat_id].timestamp > 30 * 60 * 1000) {
      delete userState[chat_id];
    }
  }
  console.log('Memory cleanup done ✅');
}, 30 * 60 * 1000);

app.post('/webhook', async (req, res) => {
  try {
    const { message, callback_query } = req.body;

    if (callback_query) {
      const chat_id = callback_query.from.id.toString();
      const data = callback_query.data;
      const message_id = callback_query.message?.message_id;

      if (data === 'set_upi') {
        await answerAlert(callback_query.id, '');
        const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
        if (users.length > 0 && users[0].upi_id) {
          await editMsg(chat_id, message_id,
            `<b>💸 UPI Details:</b>\n\n<b>UPI ID: ${users[0].upi_id}</b>`,
            [[{ text: '✏️ Update', callback_data: 'update_upi' }]]
          );
        } else {
          await editMsg(chat_id, message_id,
            `<b>💸 UPI Details:\n\nNo UPI saved.</b>`,
            [[{ text: '✏️ Update', callback_data: 'update_upi' }]]
          );
        }

      } else if (data === 'update_upi') {
        await answerAlert(callback_query.id, '');
        userState[chat_id] = { state: 'set_upi', timestamp: Date.now() };
        await sendMsg(chat_id, `<b>Please enter your UPI ID\n\nExample: john.doe@okaxis</b>`);

      } else if (data === 'set_bank') {
        await answerAlert(callback_query.id, '');
        const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
        if (users.length > 0 && users[0].bank_account) {
          await editMsg(chat_id, message_id,
            `<b>🏦 Bank Details:</b>\n\n<b>Account: ${users[0].bank_account}</b>\n<b>IFSC: ${users[0].bank_ifsc}</b>`,
            [[{ text: '✏️ Update', callback_data: 'update_bank' }]]
          );
        } else {
          await editMsg(chat_id, message_id,
            `<b>🏦 Bank Details:\n\nNo bank details saved.</b>`,
            [[{ text: '✏️ Update', callback_data: 'update_bank' }]]
          );
        }

      } else if (data === 'update_bank') {
        await answerAlert(callback_query.id, '');
        userState[chat_id] = { state: 'set_bank_account', timestamp: Date.now() };
        await sendMsg(chat_id, `<b>Please enter your account number:</b>`);

      } else if (data === 'withdraw_upi') {
        await answerAlert(callback_query.id, '');
        const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
        if (users.length > 0) {
          const u = users[0];
          if (!u.upi_id) {
            await editMsg(chat_id, message_id,
              `<b>💸 UPI Details:\n\nNo UPI saved.</b>`,
              [[{ text: '✏️ Update', callback_data: 'update_upi' }]]
            );
          } else if (parseFloat(u.balance) >= 50) {
            userState[chat_id] = { state: 'withdraw_amount', method: 'upi', payment: u.upi_id, message_id, timestamp: Date.now() };
            await editMsg(chat_id, message_id, `<b>Please enter withdrawal amount (Minimum: ₹50.00):</b>`, []);
          } else {
            await sendMsg(chat_id, `<b>❌ Minimum ₹50 Required To Withdraw!</b>`, mainKeyboard);
          }
        }

      } else if (data === 'withdraw_bank') {
        await answerAlert(callback_query.id, '');
        const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
        if (users.length > 0) {
          const u = users[0];
          if (!u.bank_account) {
            await editMsg(chat_id, message_id,
              `<b>🏦 Bank Details:\n\nNo bank details saved.</b>`,
              [[{ text: '✏️ Update', callback_data: 'update_bank' }]]
            );
          } else if (parseFloat(u.balance) >= 50) {
            userState[chat_id] = { state: 'withdraw_amount', method: 'bank', payment: `${u.bank_account} | ${u.bank_ifsc}`, message_id, timestamp: Date.now() };
            await editMsg(chat_id, message_id, `<b>Please enter withdrawal amount (Minimum: ₹50.00):</b>`, []);
          } else {
            await sendMsg(chat_id, `<b>❌ Minimum ₹50 Required To Withdraw!</b>`, mainKeyboard);
          }
        }

      } else if (data === 'approve_withdraw') {
        await answerAlert(callback_query.id, '');
        if (message_id) await deleteMsg(chat_id, message_id);
        const state = userState[chat_id];
        if (state && state.state === 'withdraw_confirm') {
          const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
          if (users.length > 0) {
            const u = users[0];
            const amt = parseFloat(state.amount);

            // ✅ Double check security
            if (isNaN(amt) || amt <= 0 || amt < 50) {
              await sendMsg(chat_id, `<b>❌ Invalid amount!</b>`, mainKeyboard);
              delete userState[chat_id];
              return res.send('OK');
            }
            if (parseFloat(u.balance) < amt) {
              await sendMsg(chat_id, `<b>❌ Insufficient balance! Available: ₹${parseFloat(u.balance).toFixed(2)}</b>`, mainKeyboard);
              delete userState[chat_id];
              return res.send('OK');
            }

            const now = getTime();
            const requestId = getRequestId();
            const newBal = parseFloat(u.balance) - amt;

            await dbPost('withdrawals', {
              telegram_id: chat_id,
              amount: amt,
              upi_id: state.payment,
              status: 'pending',
              request_id: requestId
            });
            await dbPatch('users', `telegram_id=eq.${chat_id}`, { balance: newBal < 0 ? 0 : newBal });

            await sendInlineMsg(chat_id,
              `<b>⏳ Withdrawal Request Submitted!</b>\n\n<b>📊 Request ID: ${requestId}</b>\n<b>💰 Amount: ₹${amt}</b>\n<b>📱 Method: ${state.method === 'upi' ? 'UPI' : 'Bank'}</b>\n<b>📅 Date: ${now}</b>`,
              [[{ text: '🔍 Check Status', callback_data: `status_${requestId}` }]]
            );
            await sendInlineMsg(ADMIN_ID,
              `<b>💸 New Withdraw Request!</b>\n\n<b>🧑 User: ${u.name}</b>\n<b>📱 Phone: ${u.phone}</b>\n<b>💰 Amount: ₹${amt}</b>\n<b>💳 Payment: ${state.payment}</b>\n<b>📅 Time: ${now}</b>\n<b>📊 Request ID: ${requestId}</b>`,
              [
                [{ text: '✅ Approve', callback_data: `admin_approve_${requestId}` }],
                [{ text: '❌ Cancel', callback_data: `admin_cancel_${requestId}` }]
              ]
            );
            delete userState[chat_id];
          }
        }

      } else if (data === 'cancel_withdraw') {
        await answerAlert(callback_query.id, '');
        if (message_id) await deleteMsg(chat_id, message_id);
        delete userState[chat_id];
        await sendMsg(chat_id, `<b>❌ Withdrawal Cancelled!</b>`, mainKeyboard);

      } else if (data.startsWith('status_')) {
        const requestId = data.replace('status_', '');
        const withdrawals = await dbGet('withdrawals', `request_id=eq.${requestId}`);
        if (withdrawals.length > 0) {
          const w = withdrawals[0];
          if (w.telegram_id !== chat_id && chat_id !== ADMIN_ID) {
            await answerAlert(callback_query.id, '❌ Unauthorized!');
            return res.send('OK');
          }
          const statusEmoji = w.status === 'paid' ? '✅' : w.status === 'cancelled' ? '❌' : '🕐';
          const statusText = w.status === 'paid' ? 'Paid' : w.status === 'cancelled' ? 'Cancelled' : 'Pending';
          await answerAlert(callback_query.id, `CashFlix Wallet ⚡\nStatus: ${statusText} ${statusEmoji}`);
        }

      } else if (data.startsWith('admin_approve_')) {
        if (chat_id !== ADMIN_ID) {
          await answerAlert(callback_query.id, '❌ Unauthorized!');
          return res.send('OK');
        }
        const requestId = data.replace('admin_approve_', '');
        const withdrawals = await dbGet('withdrawals', `request_id=eq.${requestId}`);
        if (withdrawals.length > 0) {
          const w = withdrawals[0];
          if (w.status !== 'pending') {
            await answerAlert(callback_query.id, '⚠️ Already processed!');
            return res.send('OK');
          }
          await dbPatch('withdrawals', `request_id=eq.${requestId}`, { status: 'paid' });
          await editMsg(ADMIN_ID, message_id,
            `<b>💸 Withdraw Request</b>\n\n<b>📊 Request ID: ${requestId}</b>\n<b>💰 Amount: ₹${w.amount}</b>\n<b>💳 Payment: ${w.upi_id}</b>\n\n<b>✅ Approved</b>`, []
          );
          await sendMsg(w.telegram_id, `<b>Your withdrawal request of ₹${parseFloat(w.amount).toFixed(2)} has been approved! ✅</b>`);
          await answerAlert(callback_query.id, '✅ Approved!');
        }

      } else if (data.startsWith('admin_cancel_')) {
        if (chat_id !== ADMIN_ID) {
          await answerAlert(callback_query.id, '❌ Unauthorized!');
          return res.send('OK');
        }
        const requestId = data.replace('admin_cancel_', '');
        const withdrawals = await dbGet('withdrawals', `request_id=eq.${requestId}`);
        if (withdrawals.length > 0) {
          const w = withdrawals[0];
          if (w.status !== 'pending') {
            await answerAlert(callback_query.id, '⚠️ Already processed!');
            return res.send('OK');
          }
          await dbPatch('withdrawals', `request_id=eq.${requestId}`, { status: 'cancelled' });
          const users = await dbGet('users', `telegram_id=eq.${w.telegram_id}`);
          if (users.length > 0) {
            const refundBal = parseFloat(users[0].balance) + parseFloat(w.amount);
            await dbPatch('users', `telegram_id=eq.${w.telegram_id}`, { balance: refundBal });
          }
          await editMsg(ADMIN_ID, message_id,
            `<b>💸 Withdraw Request</b>\n\n<b>📊 Request ID: ${requestId}</b>\n<b>💰 Amount: ₹${w.amount}</b>\n<b>💳 Payment: ${w.upi_id}</b>\n\n<b>❌ Cancelled</b>`, []
          );
          // ✅ Pehle jaisa cancel message + Contact Admin button
          await sendInlineMsg(w.telegram_id,
            `<b>❌ Your withdraw request failed. Please contact CashFlix support.</b>\n\n<b>💰 ₹${parseFloat(w.amount).toFixed(2)} has been refunded to your wallet!</b>`,
            [[{ text: '📞 Contact Admin', url: `https://t.me/${ADMIN_USERNAME}` }]]
          );
          await answerAlert(callback_query.id, '❌ Cancelled!');
        }

      } else {
        await answerAlert(callback_query.id, '');
      }

      return res.send('OK');
    }

    if (!message) return res.send('OK');
    const chat_id = message.chat.id.toString();
    const name = sanitize(message.from.first_name || 'User');

    if (message.contact) {
      const phone = message.contact.phone_number.replace(/\D/g, '').replace(/^91/, '');
      if (message.contact.user_id && message.contact.user_id.toString() !== chat_id) {
        await sendMsg(chat_id, `<b>❌ Please share your own contact only!</b>`);
        return res.send('OK');
      }
      const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
      if (users.length === 0) {
        const existing = await dbGet('users', `phone=eq.${phone}`);
        if (existing.length > 0) {
          await sendMsg(chat_id, `<b>❌ This phone number is already registered!</b>`);
          return res.send('OK');
        }
        await dbPost('users', { telegram_id: chat_id, name, phone, balance: 0, lifetime_earnings: 0 });
        await sendMsg(chat_id, `<b>✅ Registration successful! You can now use the bot.</b>`, mainKeyboard);
        await sendMsg(chat_id, `<b>👤 Profile</b>\n\n<b>🙌🏻 User: ${name} ⚡</b>\n<b>💰 Balance: ₹0.00</b>\n<b>🪢 Lifetime Earnings: ₹0.00</b>\n<b>📱 Phone: ${phone}</b>`, mainKeyboard);
      } else {
        await sendMsg(chat_id, `<b>✅ Already registered!</b>`, mainKeyboard);
      }
      return res.send('OK');
    }

    const text = message.text || '';

    if (text === '👤 Profile' || text === '💰 Withdraw') {
      delete userState[chat_id];
    }

    if (userState[chat_id]) {
      const state = userState[chat_id].state;
      const mid = userState[chat_id].message_id;

      if (state === 'set_upi') {
        if (isValidUPI(text)) {
          await dbPatch('users', `telegram_id=eq.${chat_id}`, { upi_id: text });
          delete userState[chat_id];
          await sendMsg(chat_id, `<b>✅ UPI ID updated!\n\n💳 UPI ID: ${text}</b>`, mainKeyboard);
        } else {
          await sendMsg(chat_id, `<b>❌ Invalid UPI format!\n\nExample: john.doe@okaxis</b>`);
        }
        return res.send('OK');

      } else if (state === 'set_bank_account') {
        if (/^\d{9,18}$/.test(text)) {
          userState[chat_id] = { state: 'set_bank_ifsc', account: text, timestamp: Date.now() };
          await sendMsg(chat_id, `<b>🏦 Please enter your IFSC code:</b>`);
        } else {
          await sendMsg(chat_id, `<b>❌ Invalid account number!</b>`);
        }
        return res.send('OK');

      } else if (state === 'set_bank_ifsc') {
        if (isValidIFSC(text)) {
          const account = userState[chat_id].account;
          await dbPatch('users', `telegram_id=eq.${chat_id}`, { bank_account: account, bank_ifsc: text.toUpperCase() });
          delete userState[chat_id];
          await sendMsg(chat_id, `<b>✅ Bank updated!\n\n🏦 Account: ${account}\n📋 IFSC: ${text.toUpperCase()}</b>`, mainKeyboard);
        } else {
          await sendMsg(chat_id, `<b>❌ Invalid IFSC! Example: SBIN0001234</b>`);
        }
        return res.send('OK');

      } else if (state === 'withdraw_amount') {
        const amt = parseFloat(text);
        const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
        if (users.length > 0) {
          const u = users[0];
          if (isNaN(amt) || amt < 50) {
            await sendMsg(chat_id, `<b>❌ Minimum ₹50 required!</b>`);
          } else if (amt > parseFloat(u.balance)) {
            await sendMsg(chat_id, `<b>❌ Insufficient balance! Available: ₹${parseFloat(u.balance).toFixed(2)}</b>`);
          } else {
            const method = userState[chat_id].method;
            const payment = userState[chat_id].payment;
            userState[chat_id] = { state: 'withdraw_confirm', amount: amt, method, payment, message_id: mid, timestamp: Date.now() };
            const confirmMsgId = await sendInlineMsg(chat_id,
              `<b>⚠️ Withdrawal Confirmation</b>\n\n<b>💰 Amount: ₹${amt}</b>\n<b>📱 Method: ${method === 'upi' ? 'UPI' : 'Bank'}</b>\n<b>💸 ${method === 'upi' ? 'UPI ID' : 'Bank'}: ${payment}</b>`,
              [[{ text: '✅ Confirm', callback_data: 'approve_withdraw' }, { text: '❌ Cancel', callback_data: 'cancel_withdraw' }]]
            );
            userState[chat_id].confirmMsgId = confirmMsgId;
            setTimeout(async () => {
              if (confirmMsgId) await deleteMsg(chat_id, confirmMsgId);
              if (userState[chat_id]?.state === 'withdraw_confirm') delete userState[chat_id];
            }, 60000);
          }
        }
        return res.send('OK');
      }
    }

    if (text === '/start') {
      const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
      if (users.length === 0) {
        await fetchWithTimeout(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id,
            text: `<b>👋 Welcome! Please share your phone number:</b>`,
            parse_mode: 'HTML',
            reply_markup: contactKeyboard
          })
        });
      } else {
        const u = users[0];
        await sendMsg(chat_id, `<b>👤 Profile</b>\n\n<b>🧑 User: ${u.name} ⚡</b>\n<b>💰 Balance: ₹${parseFloat(u.balance).toFixed(2)}</b>\n<b>🔁 Lifetime Earnings: ₹${parseFloat(u.lifetime_earnings).toFixed(2)}</b>\n<b>📱 Phone: ${u.phone}</b>`, mainKeyboard);
      }

    } else if (text === '👤 Profile') {
      const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
      if (users.length > 0) {
        const u = users[0];
        await sendInlineMsg(chat_id,
          `<b>👤 Profile</b>\n\n<b>🙌🏻 User: ${u.name} ⚡</b>\n<b>💰 Balance: ₹${parseFloat(u.balance).toFixed(2)}</b>\n<b>🪢 Lifetime Earnings: ₹${parseFloat(u.lifetime_earnings).toFixed(2)}</b>\n<b>📱 Phone: ${u.phone}</b>`,
          [
            [{ text: '💸 UPI', callback_data: 'set_upi' }],
            [{ text: '🏦 Bank Details', callback_data: 'set_bank' }]
          ]
        );
      }

    } else if (text === '💰 Withdraw') {
      const users = await dbGet('users', `telegram_id=eq.${chat_id}`);
      if (users.length > 0) {
        const u = users[0];
        if (parseFloat(u.balance) < 50) {
          await sendMsg(chat_id, `<b>❌ Minimum ₹50 Required To Withdraw!</b>`, mainKeyboard);
        } else if (u.upi_id && u.bank_account) {
          await sendInlineMsg(chat_id,
            `<b>Choose Payment Method:</b>`,
            [[{ text: '💸 UPI Transfer', callback_data: 'withdraw_upi' }], [{ text: '🏦 Bank Transfer', callback_data: 'withdraw_bank' }]]
          );
        } else if (u.upi_id) {
          userState[chat_id] = { state: 'withdraw_amount', method: 'upi', payment: u.upi_id, timestamp: Date.now() };
          await sendMsg(chat_id, `<b>💸 Please enter withdrawal amount (Minimum: ₹50.00):</b>`);
        } else if (u.bank_account) {
          userState[chat_id] = { state: 'withdraw_amount', method: 'bank', payment: `${u.bank_account} | ${u.bank_ifsc}`, timestamp: Date.now() };
          await sendMsg(chat_id, `<b>💸 Please enter withdrawal amount (Minimum: ₹50.00):</b>`);
        } else {
          await sendInlineMsg(chat_id,
            `<b>Choose Payment Method:</b>`,
            [[{ text: '💸 UPI Transfer', callback_data: 'withdraw_upi' }], [{ text: '🏦 Bank Transfer', callback_data: 'withdraw_bank' }]]
          );
        }
      }

    } else if (text.startsWith('/pause ') && chat_id === ADMIN_ID) {
      const offerName = text.replace('/pause ', '').trim();
      const existing = await dbGet('offer_status', `offer_name=eq.${encodeURIComponent(offerName)}`);
      if (existing.length > 0) {
        await dbPatch('offer_status', `offer_name=eq.${encodeURIComponent(offerName)}`, { is_active: false });
      } else {
        await dbPost('offer_status', { offer_name: offerName, is_active: false });
      }
      await sendMsg(ADMIN_ID, `<b>⏸️ ${offerName} — Paused!</b>`);

    } else if (text.startsWith('/resume ') && chat_id === ADMIN_ID) {
      const offerName = text.replace('/resume ', '').trim();
      const existing = await dbGet('offer_status', `offer_name=eq.${encodeURIComponent(offerName)}`);
      if (existing.length > 0) {
        await dbPatch('offer_status', `offer_name=eq.${encodeURIComponent(offerName)}`, { is_active: true });
      } else {
        await dbPost('offer_status', { offer_name: offerName, is_active: true });
      }
      await sendMsg(ADMIN_ID, `<b>▶️ ${offerName} — Resumed!</b>`);

    } else if (text === '/offers' && chat_id === ADMIN_ID) {
      const offers = await dbGet('offer_status', `order=offer_name.asc`);
      if (offers.length === 0) {
        await sendMsg(ADMIN_ID, `<b>📋 No offers!</b>`);
      } else {
        let msg = `<b>📋 Offer Status:</b>\n\n`;
        offers.forEach(o => {
          msg += `${o.is_active ? '▶️' : '⏸️'} <b>${o.offer_name}</b>\n`;
        });
        await sendMsg(ADMIN_ID, msg);
      }

    } else if (text.startsWith('/paid ') && chat_id === ADMIN_ID) {
      const phone = text.split(' ')[1];
      const users = await dbGet('users', `phone=eq.${phone}`);
      if (users.length > 0) {
        const u = users[0];
        const withdrawals = await dbGet('withdrawals', `telegram_id=eq.${u.telegram_id}&status=eq.pending&order=created_at.desc&limit=1`);
        if (withdrawals.length > 0) {
          const w = withdrawals[0];
          await dbPatch('withdrawals', `id=eq.${w.id}`, { status: 'paid' });
          await sendMsg(u.telegram_id, `<b>Your withdrawal request of ₹${parseFloat(w.amount).toFixed(2)} has been approved! ✅</b>`);
          await sendMsg(ADMIN_ID, `<b>✅ Done — ${u.name} (${u.phone}) — ₹${w.amount}</b>`);
        } else {
          await sendMsg(ADMIN_ID, `<b>❌ No pending withdrawal for ${phone}</b>`);
        }
      } else {
        await sendMsg(ADMIN_ID, `<b>❌ User not found: ${phone}</b>`);
      }
    }

  } catch(e) {
    console.error(e);
  }
  res.send('OK');
});

// ✅ Wallet Refer Create
app.post('/refer/create', async (req, res) => {
  try {
    const { offer_name, referrer_phone, user_payout, my_payout } = req.body;
    if (!offer_name || !referrer_phone) return res.json({ success: false });
    const code = generateReferCode(offer_name);
    await dbPost('wallet_referrals', {
      code, offer_name, referrer_phone,
      user_payout: user_payout || 0,
      my_payout: my_payout || 0
    });
    const landing_url = `https://campetihad.vercel.app/offer/?ref=${code}`;
    res.json({ success: true, code, landing_url });
  } catch(e) {
    console.error(e);
    res.json({ success: false });
  }
});

// ✅ Refer Amount Check
app.get('/refer/amount', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.json({ success: false });
    const referral = await dbGet('wallet_referrals', `code=eq.${code}`);
    if (referral.length === 0) return res.json({ success: false });
    res.json({ success: true, user_payout: referral[0].user_payout, my_payout: referral[0].my_payout, offer_name: referral[0].offer_name });
  } catch(e) {
    res.json({ success: false });
  }
});

// ✅ Click endpoint — unique click ID + phone save
app.post('/click', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!rateLimit(ip, 30, 60000)) return res.status(429).json({ success: false });
    const { click_id, offer_name, refer_code, phone } = req.body;
    if (!click_id || !offer_name) return res.json({ success: false });

    let referred_by = null;
    let user_payout = 0;
    let my_payout = 0;

    if (refer_code) {
      const referral = await dbGet('wallet_referrals', `code=eq.${refer_code}`);
      if (referral.length > 0) {
        referred_by = referral[0].referrer_phone;
        user_payout = referral[0].user_payout;
        my_payout = referral[0].my_payout;
      }
    }

    console.log('CLICK RECEIVED:', { click_id, offer_name, phone });
    await dbPost('clicks', {
      click_id,
      offer_name: sanitize(offer_name),
      phone: phone || null,
      referred_by,
      user_payout,
      my_payout
    });
    res.json({ success: true });
  } catch(e) {
    console.error(e);
    res.json({ success: false });
  }
});

// ✅ Offer status
app.get('/offer-status', async (req, res) => {
  try {
    const { offer } = req.query;
    if (!offer) return res.json({ is_active: true });
    const result = await dbGet('offer_status', `offer_name=eq.${encodeURIComponent(offer)}`);
    if (result.length > 0) {
      res.json({ is_active: result[0].is_active });
    } else {
      res.json({ is_active: true });
    }
  } catch(e) {
    res.json({ is_active: true });
  }
});

// ✅ Postback
app.get('/postback', async (req, res) => {
  try {
    const { click_id = 'N/A', event = 'N/A', token } = req.query;

    if (token !== POSTBACK_TOKEN) {
      console.log('INVALID TOKEN:', token);
      return res.status(403).send('Forbidden');
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!rateLimit(ip, 50, 60000)) return res.status(429).send('Too Many Requests');

    console.log('POSTBACK RECEIVED:', req.query);

    let runTime = getTime();
    let offer = 'Unknown';
    let phone = null;
    let referred_by = null;
    let user_payout_custom = 0;
    let my_payout_custom = 0;

    // ✅ Click ID se exact click dhundho
    try {
      const clicks = await dbGet('clicks', `click_id=eq.${encodeURIComponent(click_id)}&order=created_at.desc&limit=1`);
      if (clicks.length > 0) {
        offer = clicks[0].offer_name;
        phone = clicks[0].phone;
        runTime = new Date(clicks[0].created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }).replace(',', '');
        referred_by = clicks[0].referred_by;
        user_payout_custom = clicks[0].user_payout || 0;
        my_payout_custom = clicks[0].my_payout || 0;
      }
    } catch(e) {}

    // ✅ Phone se user dhundho
    if (!phone) {
      console.log('NO PHONE FOUND FOR CLICK:', click_id);
      return res.send('OK');
    }

    const config = offerConfig[offer] || {
      installAmt: 0, trialAmt: 0,
      installBalance: false, trialBalance: false,
      installComment: `${offer} Install`,
      trialComment: `${offer} Trial`
    };

    let amount = 0;
    let comment = '';
    let addBalance = false;
    const eventName = event?.trim().toLowerCase();

    if (['web', 'initial', 'install', 'e1', 'default'].includes(eventName)) {
      amount = config.installAmt || 0;
      comment = config.installComment;
      addBalance = config.installBalance;
    } else if (['trial', 'purchase', 'e2', 'gold_buy', 'signup', 'register', 'registration', 'deposit', 'trial_payment_successful'].includes(eventName)) {
      amount = config.trialAmt || 0;
      comment = config.trialComment;
      addBalance = config.trialBalance;
      if (user_payout_custom > 0) amount = user_payout_custom;
    } else {
      amount = parseFloat(req.query.amount || 0);
      comment = `${offer} Complete`;
      addBalance = true;
    }

    await dbPost('conversions', { telegram_id: phone, click_id, offer_name: offer, amount, event });

    // ✅ Phone se user dhundho
    const users = await dbGet('users', `phone=eq.${phone}`);
    const userPayment = users.length > 0 ? 'Success' : 'Failed';

    if (users.length > 0) {
      const u = users[0];
      if (addBalance && amount > 0) {
        const newBal = parseFloat(u.balance) + amount;
        const newLife = parseFloat(u.lifetime_earnings) + amount;
        await dbPatch('users', `phone=eq.${phone}`, { balance: newBal, lifetime_earnings: newLife });
        await sendMsg(u.telegram_id, `<b>🧿 Cashback Credited 🧿</b>\n\n<b>💶 Amount  = ₹${amount}</b>\n<b>💰 Updated Balance = ₹${newBal.toFixed(2)}</b>\n\n<b>💡 Comment = ${comment}</b>`);

        // ✅ Refer bonus
        if (referred_by && my_payout_custom > 0) {
          const referrers = await dbGet('users', `phone=eq.${referred_by}`);
          if (referrers.length > 0) {
            const r = referrers[0];
            const newRefBal = parseFloat(r.balance) + my_payout_custom;
            const newRefLife = parseFloat(r.lifetime_earnings) + my_payout_custom;
            await dbPatch('users', `phone=eq.${referred_by}`, { balance: newRefBal, lifetime_earnings: newRefLife });
            await sendMsg(r.telegram_id, `<b>🎉 Refer Bonus!\n\n💶 Amount = ₹${my_payout_custom}\n💰 Updated Balance = ₹${newRefBal.toFixed(2)}\n\n💡 Comment = Refer Bonus - ${offer}</b>`);
          }
        }
      } else if (amount > 0) {
        await sendMsg(u.telegram_id, `<b>🧿 Cashback Credited 🧿</b>\n\n<b>💶 Amount  = ₹${amount}</b>\n<b>💰 Updated Balance = ₹${parseFloat(u.balance).toFixed(2)}</b>\n\n<b>💡 Comment = ${comment}</b>`);
      }
    }

    const trackTime = getTime();
    let msg = '';
    if (referred_by && amount > 1) {
      msg = `<b>Conversation Count 💝</b>\n\n<b>🎁 Offer Name - ${offer}</b>\n\n<b>User Id : ${maskPhone(phone)}</b>\n<b>User Amount : ₹${amount}</b>\n<b>🥳 User Payment : ${userPayment}</b>\n\n<b>Refer Id : ${maskPhone(referred_by)}</b>\n<b>Refer Amount : ₹${my_payout_custom}</b>\n<b>🥳 Refer Payment : Success</b>\n\n<b>Run Time - ${runTime}</b>\n<b>Track Time - ${trackTime}</b>\n\n<b>Powered By - CashFlix</b>`;
    } else {
      msg = `<b>Conversation Count 💝</b>\n\n<b>🎁 Offer Name - ${offer}</b>\n\n<b>User Id : ${maskPhone(phone)}</b>\n<b>User Amount : ₹${amount}</b>\n<b>🥳 User Payment : ${userPayment}</b>\n\n<b>Run Time - ${runTime}</b>\n<b>Track Time - ${trackTime}</b>\n\n<b>Powered By - CashFlix</b>`;
    }
    await sendMsg(CHAT_ID, msg);

  } catch(e) {
    console.error(e);
  }
  res.send('OK');
});

app.get('/', (req, res) => res.send('TrackFlix Wallet Bot Running! ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));

setInterval(async () => {
  try { await fetchWithTimeout('https://campetihad-1.onrender.com/'); } catch(e) {}
}, 14 * 60 * 1000);
