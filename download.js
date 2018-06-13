const fs = require('fs');
const {sync: mkdir} = require('mkdirp');
const path = require('path');
const request = require('request');
const term = require('./term');
const ln = fs.symlinkSync;
const icon = (p, i) => term(`./node_modules/xfileicon/bin/fileicon set '${p}' '${i}'`);
const safe = p => p.toLowerCase().replace(/[\-\\\ \'\"\/\:\;\<\>\+\&]{1,}/gmi, '-');

const {ROOT, TEMP, COURSES, DATA} = require('./paths');

const courses = JSON.parse(fs.readFileSync(path.join(DATA, 'courses.json'), 'utf-8'));

let concurrent = 10;
let downloading = [];
let downloads = [];

const download = async (p, url) => {
  mkdir(TEMP);
  const parse = path.parse(p);
  const id = (Math.floor(Math.random() * 999999999) + 100000000).toString();
  const tempFile = path.join(TEMP, `${id}-${parse.base}`);

  const run = () => new Promise((resolve, reject) => {
    if(fs.existsSync(p)) return resolve();

    let downloadDetails = {
      progress: 0, total: 1, parse, path: p
    };

    downloading.push(downloadDetails);

    const req = request({method: 'GET', uri: url});
    let length = 100, sum = 0;

    req.on('response', data => {
      if(Math.floor(data.statusCode/100) == 2){
        req.pipe(fs.createWriteStream(tempFile));
      }

      downloadDetails.total = length = Number(data.headers['content-length']);
    });
    req.on('data', chunk => {
      sum += chunk.length;
      downloadDetails.progress = sum;
      updateTerminal();
    });
    req.on('end', () => {
      try{
        fs.renameSync(tempFile, p);
        resolve();
      } catch(e){
        reject();
      }
      downloading.splice(downloading.indexOf(downloadDetails), 1);
    });
    req.on('error', () => {
      reject();
      downloading.splice(downloading.indexOf(downloadDetails), 1);
    });
  });

  downloads.push(run);
  return Promise.resolve(run);
}

const lead = (n, size = 3) => {
  const s = "000000000" + n;
  return s.substr(s.length - size);
}

startQueue();

async function startQueue(){
  try{
    for(let course of courses){
      let coursePath = path.join(COURSES, course.published_title);
      let courseThumbnail = course.image_750x422;

      let lastChapter = null;

      for(let item of course.items){
        console.log(course.title, item.title);
        item.slug = safe(`${lead(item.object_index)}-${item._class}-${item.title}`);

        if(item._class == "chapter"){
          lastChapter = item;
          continue;
        } else{
          let itemPath = path.join(coursePath, lastChapter.slug, item.slug);
          mkdir(itemPath);
          fs.writeFileSync(path.join(itemPath, item._class + '.json'), JSON.stringify(item, null, 2));
          let assets = [];
          if(item.asset) assets.push(item.asset);
          if(item.supplementary_assets) assets = assets.concat(item.supplementary_assets);

          for(let asset of assets){
            //Video File Article ExternalLink
            if(asset.asset_type == "Video"){
              let videoPath = path.join(itemPath, "videos");
              mkdir(videoPath);
              await download(path.join(videoPath, safe(asset.title)), asset.stream_urls.Video[0].file);
              for(let caption of asset.captions){
                let captionPath = path.join(videoPath, "captions");
                mkdir(captionPath);
                await download(path.join(captionPath, safe(caption.title)), caption.url);
              }
            } else if(asset.asset_type == "File"){
              let filePath = path.join(itemPath, "files");
              mkdir(filePath);
              await download(path.join(filePath, safe(asset.title)), asset.download_urls.File[0].file);
            } else if(asset.asset_type == "Article"){
              let articlePath = path.join(itemPath, "articles");
              mkdir(articlePath);
              fs.writeFileSync(path.join(articlePath, safe(`${asset.title || 'article'}.html`)), asset.body);
            } else if(asset.asset_type == "ExternalLink"){
              let linkPath = path.join(itemPath, "links");
              mkdir(linkPath);
              fs.writeFileSync(path.join(linkPath, safe(`${asset.title || 'link'}.url`)), `URL=${asset.external_url}`);
            }
          }
        }
      }
    }

    for(let i = 0; i < concurrent; i++) downloadLoop();
  } catch(e){
    startQueue();
  }
}

function downloadLoop(){
  // downloads = downloads.sort(() => Math.random() - 0.5);
  const down = downloads.shift();
  if(down) down()
  .then(downloadLoop)
  .catch(e => {
    downloads.push(down);
  });
}

function updateTerminal(){
  let lines = [
    '\x1Bc',
    `Downloading... (${downloading.length + downloads.length} left)`
  ];

  for(let d of downloading){
    let string = "", length = 70, ratio = d.progress/d.total;
    for(let j = 0; j < length; j++) string += j < ratio * length ? "#" : "-";
    toWrite = `[${string}] ${(ratio * 100).toFixed(2)}% - ${d.parse.base}`;
    lines.push(toWrite);
  }

  console.log(lines.join("\n"));
}
