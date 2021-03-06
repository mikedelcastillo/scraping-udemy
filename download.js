const fs = require('fs');
const {sync: mkdir} = require('mkdirp');
const path = require('path');
const request = require('request');
const ln = fs.symlinkSync;
const icon = (p, i) => term(`./node_modules/xfileicon/bin/fileicon set '${p}' '${i}'`);
const safe = p => p.toLowerCase().replace(/[\-\\\ \'\"\/\:\;\<\>\+\&]{1,}/gmi, '-');
const escape = (unsafe) => unsafe
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const {ROOT, TEMP, COURSES, DATA} = require('./paths');

const courses = JSON.parse(fs.readFileSync(path.join(DATA, 'courses.json'), 'utf-8'));

let concurrent = Number(process.argv[2]) || 30;
let downloading = [];
let downloads = [];

let extensions = {
  '.vtt': 0,
  '.txt': 1,
  '.html': 2,
  '.css': 2,
  '.js': 2,

  '.pdf': 3,
  '.xlsx': 4,

  '.png': 5,
  '.jpg': 5,

  '.ogg': 6,
  '.zip': 7,

  '.mp4': 8,
  '.mov': 8,
  '.m4v': 8,
};

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

  run.ext = parse.ext;
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

      let videos = [];
      let lastChapter = null;

      for(let item of course.items){

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
            if(asset.asset_type == "Video"){
              let videoPath = path.join(itemPath, "videos");
              let videoFile = path.join(videoPath, safe(asset.title));
              let captionFile;

              mkdir(videoPath);

              await download(videoFile, asset.stream_urls.Video[0].file);

              for(let caption of asset.captions){
                let captionPath = path.join(videoPath, "captions");
                captionFile = path.join(captionPath, safe(caption.title));

                mkdir(captionPath);
                await download(captionFile, caption.url);
              }

              videos.push({
                chapter: lastChapter.title,
                chapter_index: lead(lastChapter.object_index),
                title: item.title,
                item_index: lead(item.object_index),
                video_file: videoFile,
                caption_file: captionFile
              });

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

      console.log(course.title);
      fs.writeFileSync(path.join(coursePath, 'playlist.xspf'),
      `<?xml version="1.0" encoding="UTF-8"?>
        <playlist xmlns="http://xspf.org/ns/0/" xmlns:vlc="http://www.videolan.org/vlc/playlist/ns/0/" version="1">
          <title>Course Playlist</title>
          <trackList>
            ${videos.map(video => `
              <track>
                <location>${encodeURI(path.relative(coursePath, video.video_file)).replace(/\?/g,"%3F")}</location>
                <title>${video.chapter_index} ${video.item_index} ${escape(video.title)}</title>
                <extension application="http://www.videolan.org/vlc/playlist/0">
                  <playing>${Number(video.item_index)}</playing>

                </extension>
              </track>
            `).join("")}
          </trackList>
        </playlist>
      `);
    }

    // downloads = downloads.sort((a, b) => {
    //   let c = extensions[a.ext] || Infinity;
    //   let d = extensions[b.ext] || Infinity;
    //
    //   return c - d;
    // });

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
