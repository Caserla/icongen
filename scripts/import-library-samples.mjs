// Emits an apply_patch patch; never publishes samples or modifies their source.
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const source = resolve(process.argv[2] ?? '');
const target = resolve(process.argv[3] ?? '.');
const manifest = JSON.parse(readFileSync(join(source, 'development-manifest.json'), 'utf8'));
if (!['development-samples','released'].includes(manifest.status)) throw Error('Expected development samples or released assets');
const existingText=readFileSync(join(target,'apps/web/src/features/library/catalog.json'),'utf8');
const existing=JSON.parse(existingText);
const extraNames=['Archive box','Filing cabinet','Folder','Lipstick','Perfume bottle','Makeup brush','Calendar','Reservation ticket','Door hanger','Laptop','Monitor','Mouse','Closed envelope','Open envelope','Mailbox','Stethoscope','Pill','First aid kit','Padlock','Shield','Security camera','Map pin','Folded map','Signpost'];
const batchNames={home:'House|Door|Window|T-shirt|Dress|Coat|Eraser|Pencil|Stapler|Palette|Color swatches|Easel|Book|Graduation cap|Blackboard|Banknote|Coin stack|Piggy bank|Shopping bag|Shopping cart|Storefront|Notification bell|Megaphone|Alarm light',animals:'Rabbit|Whale|Butterfly|Stroller|Baby rattle|Bib|Residential building|Factory|Warehouse|Briefcase|Lectern|Business card holder|Telephone receiver|Desk phone|Walkie-talkie|Car|Van|Pickup truck|Car tire|Car jack|Fuel nozzle|Dice|Casino chips|Playing cards',christmas:'Christmas tree|Christmas stocking|Gift box|Scarf|Knit hat|Mittens|Coffee cup|Moka pot|Coffee dripper|Armchair|Sofa|Dining table|Game controller|Chess pawn|Joystick|Leaf|Mountain peaks|Flower|Dog|Pet collar|Pet bowl|Suitcase|Passport|Tent',delivery:'Shipping box|Delivery truck|Hand truck|Pen nib|Drawing compass|Set square|Smartwatch|E-reader|Tablet|Projector|Webcam|Printer|Dumbbell|Yoga mat|Workout bench|Hamburger|Sushi|Baguette|Jack-o-lantern|Ghost|Witch hat|Router|Ethernet plug|Satellite dish',ecology:'Seedling|Solar panel|Recycling bin|Bathroom scale|Thermometer|Blister pack|Arch bridge|Obelisk|Classical column|Military helmet|Canteen|Dog tags|Smartphone|Phone stand|Charger|Wrench|Screwdriver|Needle-nose pliers|Camcorder|Film reel|Clapperboard|Camera|Speaker|Landscape photo',space:'Rocket|Ringed planet|Crescent moon|Astronaut helmet|Satellite|Lunar lander|Football|Basketball|Baseball|Tennis racket|Table tennis paddle|Shuttlecock|Rotary telephone|Cordless phone|Phone booth|Magnifying glass|Telescope|Binoculars|Wedding rings|Wedding cake|Wedding bouquet|VR headset|VR controller|Haptic glove'};
const names = ['Key','Paperclip','Bookmark','Document','Documents','Binder','Smile','Surprised','Sleepy','Alarm clock','Hourglass','Stopwatch','Sun','Rain cloud','Snowflake','Apple','Carrot','Egg','Battery','Wind turbine','Power plug','Cooking pot','Whisk','Cutting board'];
const allowed = new Set(['d','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','fill-rule']);
const files = [];
const catalog = manifest.designs.map((design, index) => {
  if(existing.some(item=>item.id===design.id))return null;
  if(['linear','outline','bold','broken','bulk','twotone'].some(style=>!design.styles[style]))throw Error('Incomplete style family');
  const variants = {};
  for (const [style, file] of Object.entries(design.styles)) {
    const filename = resolve(source, file.directory, file.svg);
    if (!filename.startsWith(source + '/')) throw Error('Invalid source path');
    const svg = readFileSync(filename, 'utf8');
    if (/<(?!\/?(?:svg|path)\b)/.test(svg)) throw Error('Unsupported SVG element');
    const paths = [...svg.matchAll(/<path\s+([^>]+)>/g)].map((match) => {
      const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
      for (const [key, value] of Object.entries(attributes)) {
        if (!allowed.has(key) || /[<>&]|url\(/i.test(value)) throw Error('Unsafe attribute');
      }
      if (!attributes.d || !/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]+$/.test(attributes.d)) throw Error('Invalid path');
      return attributes;
    });
    if (!paths.length) throw Error('Missing paths');
    variants[style] = { viewBox: '0 0 24 24', paths, supportsStroke: false };
    files.push([`apps/web/public/library/samples/${design.id}/${style}.svg`, svg.replace('color="#253044"', 'color="#e5e5e5"')]);
  }
  const data = JSON.stringify(variants);
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
  files.push([`apps/web/public/library/samples/${design.id}/${hash}.json`, data]);
  const firstCategory=manifest.designs[0].category;
  const nameEn=design.nameEn??(batchNames[firstCategory]?.split('|')[index]??(firstCategory==='archive'?extraNames[index]:firstCategory==='essential'?names[index]:undefined));
  if(!nameEn)throw Error(`Missing English name: ${design.id}`);
  return { id: design.id, nameZh: design.nameZh, nameEn, category: design.category, version: hash, styles: Object.keys(variants), status: 'development-sample', sourceBatch:source.split('/').pop(), sourceStatus:manifest.status, url: `/library/samples/${design.id}/${hash}.json` };
}).filter(Boolean);
const catalogPatch=`*** Update File: ${join(target,'apps/web/src/features/library/catalog.json')}\n@@\n${existingText.trimEnd().split('\n').map(line=>'-'+line).join('\n')}\n${JSON.stringify([...existing,...catalog],null,2).split('\n').map(line=>'+'+line).join('\n')}\n`;
const selected = process.argv[4] ? files.filter(([path]) => process.argv[4] === 'catalog' ? path.endsWith('catalog.json') : path.includes(`/samples/${process.argv[4]}/`)) : files;
process.stdout.write('*** Begin Patch\n' + selected.map(([path, text]) => `*** Add File: ${join(target, path)}\n${text.trimEnd().split('\n').map(line => '+' + line).join('\n')}\n`).join('') + (!process.argv[4]||process.argv[4]==='catalog'?catalogPatch:'') + '*** End Patch\n');
