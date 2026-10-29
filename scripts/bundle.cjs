const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">',() => '<style>\n' + fs.readFileSync(path.join(root,'styles.css'),'utf8') + '\n</style>');
for (const filename of ['trainer.js','app.js']) {
  html = html.replace(`<script src="${filename}" defer></script>`,'');
  html = html.replace('</body>',() => '<script>\n' + fs.readFileSync(path.join(root,filename),'utf8').replace(/<\/script/gi,'<\\/script') + '\n</script>\n</body>');
}
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','index.html'),html);
console.log('Built dist/index.html (standalone, no external dependencies)');
