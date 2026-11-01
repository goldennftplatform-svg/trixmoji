import fs from 'fs';
import path from 'path';

const file = path.resolve('C:/Users/franc/Desktop/DOSWAPZ/sitemap.xml');
let s = fs.readFileSync(file, 'utf8');

s = s.replace(/https:\/\/doswapz\.com\/classic\/hub\.html/g, 'https://doswapz.com/past');
s = s.replace(/https:\/\/doswapz\.com\/orbit\/hub\.html/g, 'https://doswapz.com/present');
s = s.replace(/https:\/\/doswapz\.com\/classic\/harbinger\.html/g, 'https://doswapz.com/harbinger/past');
s = s.replace(/https:\/\/doswapz\.com\/orbit\/harbinger\.html/g, 'https://doswapz.com/harbinger/present');
s = s.replace(/https:\/\/doswapz\.com\/harbinger\.html/g, 'https://doswapz.com/harbinger/past');
s = s.replace(/https:\/\/doswapz\.com\/classic\/pages\/([^<]+)\.html/g, function (_, rest) {
  rest = rest.replace(/\/index$/, '');
  return 'https://doswapz.com/' + rest + '/past';
});
s = s.replace(/https:\/\/doswapz\.com\/orbit\/pages\/([^<]+)\.html/g, function (_, rest) {
  rest = rest.replace(/\/index$/, '');
  return 'https://doswapz.com/' + rest + '/present';
});

fs.writeFileSync(file, s, 'utf8');
console.log('sitemap updated');
