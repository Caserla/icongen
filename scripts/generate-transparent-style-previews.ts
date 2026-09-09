import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadConfig } from '../services/icon-worker/src/config';
import { createImageProvider } from '../services/icon-worker/src/registries';
import { iconSkillPromptCompiler } from '../services/icon-worker/src/adapters/icon-skill-prompt-compiler';
import { SharpImageProcessor } from '../services/icon-worker/src/adapters/sharp-image-processor';
import { SharpImageQualityGate } from '../services/icon-worker/src/adapters/sharp-image-quality-gate';
import { generateValidatedImage } from '../packages/backend-core/src/generate-validated-image';
import type { IconStyle } from '@icongen/shared';

const designs: {style:IconStyle['preset'];brand:string;composition:string;subject:string;palette:string[]}[] = [
  {style:'isometric-3d',brand:'FOLD',composition:'Immersive lower-left isometric foreground, receding diagonally toward upper right; leave upper-left 35% transparent.',subject:'A tiny folded-paper coffee kiosk with one oversized cup. An original F symbol made of two folded tabs is embossed on the cup; counter and awning share the same fold motif. No broad ground slab.',palette:['#C95E38','#F1C778','#31535B']},
  {style:'neon',brand:'PULSE',composition:'Asymmetric diagonal ribbon enters near lower left and climbs rightward, with one large P emblem at upper right, ample transparent holes.',subject:'One continuous luminous tube bends into an original P-shaped soundwave emblem with a single offset inner loop. Controlled emissive edges, not a glow-filled canvas.',palette:['#CC64E8','#52C9DE','#D9E6FC']},
  {style:'low-poly',brand:'RIDGE',composition:'Wide layered ridge grows from the bottom, highest peak off-center right; bottom is visually anchored at 96% canvas height; upper 40% stays transparent.',subject:'Three large faceted mountain masses share a zigzag valley forming an original R-like trail cutout. No sky, sun disk, terrain backdrop or rectangular base.',palette:['#31587A','#C77751','#E8BB82']},
  {style:'clay-3d',brand:'BLOOM',composition:'Large soft foreground object lower right, small attached leaf upper left; close-up tactile presence, not a centered floating sphere.',subject:'An original lowercase b sprout emblem sculpted as one clay form, with a folded leaf emerging from its stem and broad open counter. No pot, pedestal or ground shadow.',palette:['#A9627E','#E8B68C','#506F73']},
  {style:'flat-playful',brand:'LOOP',composition:'Loose staggered diagonal repeat of three branded cup motifs across the square, largest lower left; transparent gaps, NOT an icon grid or separate cards.',subject:'Reusable drink cups share an original loop-droplet logo, rounded flat color planes, one tilted cup dominates and two smaller echoes create a playful branded pattern. No scene background.',palette:['#D86547','#F0C966','#427E86']},
  {style:'pixel-art',brand:'BYTE',composition:'Stepped pixel cluster rises from bottom left toward upper right; one main emblem and two small data fragments; upper-left negative space.',subject:'An original B-shaped pixel vault built from a consistent 32-unit grid, with one keyhole cutout as the brand signature, crisp integer-block edges. No HUD panel or background grid.',palette:['#625AAB','#D39659','#BBD2D9']},
  {style:'flat-illustration',brand:'SOL',composition:'Immersive botanical foreground rises from the lower edge, broad bottom leaves and tall off-center stem, top third mostly transparent.',subject:'A sculptural plant whose three broad leaves share a split-sun cutout, forming the original SOL brand symbol naturally in the foliage. Flat layered silhouettes, no sky, wall, pot or ground rectangle.',palette:['#3B7778','#D78E52','#B5BE7D']},
  {style:'cute-sticker',brand:'MOMO',composition:'Friendly character peeks upward from the bottom right, one waving arm extends left, generous transparent space upper left.',subject:'Original rounded peach mascot holding a tiny folded M ribbon logo. One joyful face, short limbs and clean ivory sticker contour hugging only the character. No oval badge or backing card.',palette:['#DF987E','#A56986','#F0DBC0']},
  {style:'minimal-logo',brand:'EASY ICON',composition:'Editorial horizontal emblem anchored left of center; small echo module lower right gives asymmetric balance, not a centered app tile.',subject:'Original E/i monogram: three horizontal cut planes share one upright spine, the middle plane folds to reveal a square negative-space spark. One semantic fold, no generic arrow or existing trademark, no extra wordmark.',palette:['#5465A8','#DA9461','#D9E1EA']},
];
const out=resolve('apps/web/public/images/icon-style-previews/transparent-v1');
const records=resolve('work/transparent-style-previews');
const config=loadConfig();
if(config.IMAGE_PROVIDER!=='openai')throw new Error('Real image provider required');
const deps={imageProvider:createImageProvider(config),imageProcessor:new SharpImageProcessor(),imageQualityGate:new SharpImageQualityGate(),logger:{info:(m:string,c?:unknown)=>console.log(m,JSON.stringify(c)),error:(m:string)=>console.error(m)}};
await mkdir(out,{recursive:true});await mkdir(records,{recursive:true});
await writeFile(resolve(records,'brief.json'),JSON.stringify({brand:'EASY ICON demo brands',output:'nine original RGBA foreground previews',referenceNotes:'S06: integrate symbol into object; separate trademark shapes not copied. S10/S11/S13/S16 material language follows product presets. Cross-reference CP-0023/0028/0321; transparent canvas excluded from color area ratios; change hue families and accent proportions.',pitfall_guardrails:['FC-07: broad readable cuts, avoid tiny text','FC-08: motifs share a mother shape, no unrelated inventory-icon collage','FC-11: unified corner language and clean alpha edges'],smallSize:'24/32px retain silhouette and main cutout; wordmarks intentionally omitted',designs},null,2));
for(const d of designs){
  const path=resolve(out,`${d.style}.png`);
  try{const existing=await readFile(path);const meta=await deps.imageProcessor.inspect({bytes:existing});if(meta.hasTransparency){console.log('cached',d.style);continue;}}catch{}
  const description=`Original fictional ${d.brand} brand foreground. ${d.subject} ${d.composition} Palette: primary ${d.palette[0]} 60%, secondary ${d.palette[1]} 30%, accent ${d.palette[2]} 10% of artwork only. Use a graphical brand emblem, not long generated text.`;
  const compiled=iconSkillPromptCompiler.compile({purpose:'app-icon',name:d.brand,description,color:{mode:'solid',color:d.palette[0]},background:{enabled:false},style:{preset:d.style,subjectSizePercent:85,linearStrokeWidthPercent:3.5,subjectOpacityPercent:100,strokeWeight:'regular',cornerStyle:'balanced',detailLevel:'standard'},sizes:[128],slot:1});
  const prompt=`${compiled.prompt}\n\nPREVIEW FOREGROUND OVERRIDE: This is a transparent compositing layer, not a finished launcher tile. Override generic centered/safe-area composition with: ${d.composition} Keep a 4% transparent guard around the entire artwork for clean alpha validation; do not crop. All empty space and holes are alpha zero. No background color, rounded-square plate, sky, floor, cast shadow, checkerboard, mockup or presentation board. ${description}`;
  await writeFile(resolve(records,`${d.style}.prompt.txt`),prompt);
  console.log('generating',d.style);
  try{
    const result=await generateValidatedImage({jobId:'transparent-style-previews-v1',variantId:d.style,prompt,outputBackground:'transparent',purpose:'app-icon',stylePreset:d.style},deps);
    await writeFile(path,result.image.bytes);
    const {data,info}=await sharp(result.image.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;
    const report={style:d.style,path,width:info.width,height:info.height,transparentFraction:transparent/(info.width*info.height),warnings:result.qualityWarnings,providerRequestId:result.image.providerRequestId};
    await writeFile(resolve(records,`${d.style}.result.json`),JSON.stringify(report,null,2));console.log('completed',JSON.stringify(report));
  }catch(error){console.error('failed',d.style,error instanceof Error?error.message:'generation failed');process.exitCode=1;break;}
}
