// Dados de exemplo do protótipo de layout do PDV (sem backend).

export const CATEGORIES = ['Todos', 'Pães', 'Salgados', 'Doces', 'Bebidas', 'Frios', 'Mercearia']

export const CATEGORY_COLORS = {
  'Pães': 'border-l-amber-500',
  'Salgados': 'border-l-orange-500',
  'Doces': 'border-l-pink-500',
  'Bebidas': 'border-l-sky-500',
  'Frios': 'border-l-rose-500',
  'Mercearia': 'border-l-violet-500',
}

// soldBy: UN = unidade, KG = quilo. scaleCode = código impresso na etiqueta da balança.
export const PRODUCTS = [
  { id: 1, name: 'Pão francês', category: 'Pães', soldBy: 'KG', price: 16.9, scaleCode: '00001', favorite: true },
  { id: 2, name: 'Pão de queijo', category: 'Pães', soldBy: 'UN', price: 1.8, barcode: '2900000000021', favorite: true },
  { id: 3, name: 'Pão de forma 500g', category: 'Pães', soldBy: 'UN', price: 9.9, barcode: '7890000000031' },
  { id: 4, name: 'Pão doce', category: 'Pães', soldBy: 'UN', price: 4.5, barcode: '2900000000045', favorite: true },
  { id: 5, name: 'Croissant', category: 'Pães', soldBy: 'UN', price: 7.5, barcode: '2900000000052' },
  { id: 6, name: 'Coxinha', category: 'Salgados', soldBy: 'UN', price: 7.0, barcode: '2900000000069', favorite: true },
  { id: 7, name: 'Esfiha de carne', category: 'Salgados', soldBy: 'UN', price: 6.5, barcode: '2900000000076' },
  { id: 8, name: 'Misto quente', category: 'Salgados', soldBy: 'UN', price: 9.0, barcode: '2900000000083' },
  { id: 9, name: 'Sonho', category: 'Doces', soldBy: 'UN', price: 6.5, barcode: '2900000000090', favorite: true },
  { id: 10, name: 'Bolo de cenoura (fatia)', category: 'Doces', soldBy: 'UN', price: 8.0, barcode: '2900000000106' },
  { id: 11, name: 'Brigadeiro', category: 'Doces', soldBy: 'UN', price: 3.5, barcode: '2900000000113' },
  { id: 12, name: 'Café expresso', category: 'Bebidas', soldBy: 'UN', price: 5.0, barcode: '2900000000120', favorite: true },
  { id: 13, name: 'Café com leite', category: 'Bebidas', soldBy: 'UN', price: 6.5, barcode: '2900000000137', favorite: true },
  { id: 14, name: 'Refrigerante lata 350ml', category: 'Bebidas', soldBy: 'UN', price: 6.0, barcode: '7890000000017' },
  { id: 15, name: 'Suco de laranja 300ml', category: 'Bebidas', soldBy: 'UN', price: 7.0, barcode: '2900000000151' },
  { id: 16, name: 'Presunto fatiado', category: 'Frios', soldBy: 'KG', price: 39.9, scaleCode: '00016' },
  { id: 17, name: 'Queijo mussarela', category: 'Frios', soldBy: 'KG', price: 49.9, scaleCode: '00017' },
  { id: 18, name: 'Leite integral 1L', category: 'Mercearia', soldBy: 'UN', price: 5.49, barcode: '7890000000024' },
  { id: 19, name: 'Manteiga 200g', category: 'Mercearia', soldBy: 'UN', price: 12.9, barcode: '7890000000048' },
  { id: 20, name: 'Requeijão 200g', category: 'Mercearia', soldBy: 'UN', price: 8.9, barcode: '7890000000055' },
]

export const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Dinheiro', short: 'Dinheiro' },
  { id: 'PIX', label: 'Pix', short: 'Pix' },
  { id: 'DEBIT', label: 'Cartão de débito', short: 'Débito' },
  { id: 'CREDIT', label: 'Cartão de crédito', short: 'Crédito' },
]

// Resumo do caixa usado na tela de fechamento
export const CASH_SESSION = {
  register: 'Caixa 01 · Balcão',
  operator: 'Ana',
  openedAt: '06:02',
  openingAmount: 150,
  salesCount: 87,
  byMethod: { CASH: 812.4, PIX: 964.3, DEBIT: 401.9, CREDIT: 167 },
  movements: [
    { id: 1, type: 'SANGRIA', time: '10:31', amount: 400, reason: 'Excesso de dinheiro na gaveta' },
    { id: 2, type: 'SUPRIMENTO', time: '12:05', amount: 50, reason: 'Troco em moedas' },
  ],
}

export const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const kg = (v) => `${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
export const round2 = (v) => Math.round(v * 100) / 100

// Etiqueta de balança EAN-13: 2 + código do produto (6) + preço em centavos (5) + dígito verificador.
// Ex: 2 000001 00850 8 = produto 1, R$ 8,50. Na versão final o formato (preço ou peso) será configurável.
export function parseScaleLabel(code) {
  if (!/^2\d{12}$/.test(code)) return null
  const productCode = Number(code.slice(1, 7))
  const product = PRODUCTS.find((p) => p.scaleCode && Number(p.scaleCode) === productCode)
  if (!product) return null
  const total = Number(code.slice(7, 12)) / 100
  return { product, total, weight: Math.round((total / product.price) * 1000) / 1000 }
}
