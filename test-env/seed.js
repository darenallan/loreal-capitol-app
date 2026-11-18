/**
 * Remplit l'émulateur Firebase LOCAL avec un jeu de données fictif (2 boutiques).
 * Refuse de tourner contre autre chose que 127.0.0.1 — la prod n'est jamais touchée.
 * Usage : npm run seed:test   (émulateur démarré au préalable)
 */
const BASE = process.env.EMULATOR_URL || 'http://127.0.0.1:9000';
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
  console.error('Refus : le seed ne cible que l’émulateur local.');
  process.exit(1);
}

const users = {
  boss: { id: 'boss', name: 'Boss', role: 'admin', pin: 'B000000.', store: 'all' },
  yaya: { id: 'yaya', name: 'Yaya', role: 'caissiere', pin: 'Y000000.', store: 'falaise' },
  maya: { id: 'maya', name: 'Maya', role: 'caissiere', pin: 'M000000.', store: 'falaise' },
  angele: { id: 'angele', name: 'Angèle', role: 'caissiere', pin: 'A000000.', store: 'tougou' },
  ivy: { id: 'ivy', name: 'Ivy', role: 'caissiere', pin: 'I000000.', store: 'tougou' },
  esther: { id: 'esther', name: 'Esther', role: 'admin', pin: 'E000000.', store: 'tougou' },
};

const catalog = [
  ['Costume Alfredo Bleu Nuit', 'Costumes', 85000, 'L', 'Bleu Nuit', 'ALF-BN'],
  ['Veste Albacost Grise', 'Vestes', 45000, 'M', 'Gris', 'ALB-GR'],
  ['Chaussures Berwick Blanc', 'Chaussures', 60000, '42', 'Blanc', 'BER-WH'],
  ['Chemise Lin Écru', 'Chemises', 18000, 'L', 'Écru', 'CHL-EC'],
  ['Robe Plissée Or', 'Robes', 52000, 'S', 'Or', 'RPL-OR'],
  ['Ceinture Cuir Noir', 'Accessoires', 12000, 'U', 'Noir', 'CEI-NR'],
];

const products = {};
for (const store of ['falaise', 'tougou']) {
  catalog.forEach(([name, category, price, size, color, reference], i) => {
    const id = `test_${store}_${i}`;
    const stock = store === 'falaise' ? 10 - i : 3 + i;
    products[id] = {
      name, category, price, size, color, reference, stock, quantity: stock, store,
      barcode: `CAPITOL-TEST-${store.toUpperCase()}-${i}`,
      createdAt: new Date().toISOString(),
    };
  });
}

// Ventes sur les 10 derniers jours, les deux boutiques
const sales = {};
const sellers = { falaise: ['Yaya', 'Maya'], tougou: ['Angèle', 'Ivy'] };
let n = 0;
for (let day = 0; day < 10; day++) {
  for (const store of ['falaise', 'tougou']) {
    for (let k = 0; k < 3; k++) {
      const idx = (day + k) % catalog.length;
      const [name, , price, size, color, reference] = catalog[idx];
      const d = new Date();
      d.setDate(d.getDate() - day);
      d.setHours(9 + k * 3, 15, 0, 0);
      const seller = sellers[store][k % 2];
      sales[`test_sale_${n++}`] = {
        total: price, article_total: price, date: d.toISOString(),
        payment_method: ['Espèces', 'OM', 'MoMo', 'Carte Bancaire'][(day + k) % 4],
        user_id: seller.toLowerCase(), seller_name: seller, beneficiary: '',
        is_advance: 0, client_name: k === 1 ? ['Mme Ngo', 'M. Fotso', 'Mme Bella'][day % 3] : '',
        client_phone: k === 1 ? ['690000001', '690000002', '690000003'][day % 3] : '', client_email: '',
        advanceData: null, sale_label: null, store,
        items: [{ product_id: `test_${store}_${idx}`, name, quantity: 1, price, size, color, reference }],
      };
    }
  }
}

const advances = {
  test_adv_late: {
    sale_id: 'test_sale_adv_late', client_name: 'M. Fotso', client_phone: '690000002', client_email: '',
    amount_paid: 10000, amount_remaining: 42000, due_date: new Date(Date.now() - 5 * 864e5).toISOString().split('T')[0],
    status: 'pending', created_at: new Date(Date.now() - 20 * 864e5).toISOString(), product_name: 'Robe Plissée Or (x1)',
    items: [{ product_id: 'test_tougou_4', name: 'Robe Plissée Or', quantity: 1, price: 52000 }],
    reference: 'RPL-OR', size: 'S', color: 'Or', store: 'tougou', seller_name: 'Ivy', user_id: 'ivy',
    payments: [{ date: new Date(Date.now() - 20 * 864e5).toISOString(), amount: 10000, method: 'OM' }],
  },
  test_adv_1: {
    sale_id: 'test_sale_adv_1', client_name: 'Client Test', client_phone: '600000000', client_email: '',
    amount_paid: 20000, amount_remaining: 65000, due_date: new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0],
    status: 'pending', created_at: new Date().toISOString(), product_name: 'Costume Alfredo Bleu Nuit (x1)',
    items: [{ product_id: 'test_falaise_0', name: 'Costume Alfredo Bleu Nuit', quantity: 1, price: 85000 }],
    reference: 'ALF-BN', size: 'L', color: 'Bleu Nuit', store: 'falaise', seller_name: 'Yaya', user_id: 'yaya',
    payments: [{ date: new Date().toISOString(), amount: 20000, method: 'Espèces' }],
  },
};

(async () => {
  const body = { users, products, sales, advances };
  const res = await fetch(`${BASE}/.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('Seed échoué', res.status, await res.text());
    process.exit(1);
  }
  console.log(`Seed OK → ${Object.keys(products).length} produits, ${Object.keys(sales).length} ventes, 2 acomptes, ${Object.keys(users).length} utilisateurs`);
})();
