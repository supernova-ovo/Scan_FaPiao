const defaults = {
  invoiceVerifyUrl: '/thirdpartservice/fapiao/invoice/pdf',
  uploadUrl: 'https://test1.tepc.cn/jetopcms/KS/editor/upload_json.ashx?dir=file',
  scanServiceUrl: '/api/invoice/scan',
  invoiceDetailSectionId: 'bb3679a9-0e4f-4fce-8b06-2e53fd0e2472',
  invoiceGoodsSectionId: '63cf301e-759b-48d9-956a-d55538d8a9ea',
  invoiceScanLogSectionId: 'd0855c81-fd6a-7c63-5eb7-e9d5e7b92cf5',
  companyAllowSectionId: '1c948542-dea6-f610-0ec6-c8e02149c0ea',
  jetopApiBaseUrl: '/jetopcms',
  jetopAuthToken: '3FF0773D01A515D92C4AFFA3DD49EA88228E8C8E2D35E99AE116DE2413A8772A08061620225C1C2DBDF49D3CB79DAECACCBA4D1C97A726EF36FB0B0F2E739BD99A3C1B3B73B1CE5C36CD6967328C6F7AB2CD186B2F6A9FE112E0C79B3980ED7169BABDC39744AB7A2FF1FBAA5B415D04A28031072E874673B109343A9B630453C6AEE7780DB5D3946B08A2B40AE64F62ED2E9CC4CD787310'
};

const runtime = typeof window !== 'undefined' && window.APP_CONFIG ? window.APP_CONFIG : {};

export const appConfig = {
  ...defaults,
  ...runtime
};
