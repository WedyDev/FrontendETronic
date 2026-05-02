
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 817, hash: '9f27d69a07a437aa4dc1bb8c78fbe142816648a09831804b4fc94f9b55ad60ec', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1004, hash: '5d18abdfa50ac26af9957f8d76139267e9ac828b713bda2d86b277223746d314', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 14477, hash: '9964527e4a027a9deb7bafed01a7259294a853e8d1bef5a4fd238550892e8d5d', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'styles-TZGRLF2P.css': {size: 653, hash: 'N1mtZeeHJeU', text: () => import('./assets-chunks/styles-TZGRLF2P_css.mjs').then(m => m.default)}
  },
};
