const nodemailer = require('nodemailer');

// Configure transporter (use your email service – here using Gmail as example)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendOrderConfirmationEmail(userEmail, orderId, items, totalAmount, pickupTime, phone) {
  const itemList = items.map(item => {
    const name = item.name || (item.product && item.product.name) || item.productId || 'Unknown item';
    return `- ${name} x${item.quantity}`;
  }).join('\n');
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Order Confirmation - Pharmacy',
    text: `Your order #${orderId} has been received.\nItems:\n${itemList}\nTotal: $${totalAmount}\nPickup time: ${new Date(pickupTime).toLocaleString()}\nPhone: ${phone}\nWe'll notify you when ready.`
  };
  await transporter.sendMail(mailOptions);
}

async function sendOrderReadyEmail(userEmail, orderId) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: 'Your order is ready for pickup!',
    text: `Order #${orderId} is now ready. Please pick it up at your selected time. Thank you.`
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendOrderConfirmationEmail, sendOrderReadyEmail };