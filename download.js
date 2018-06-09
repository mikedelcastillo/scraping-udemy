require('dotenv').config();
const axios = require('axios');
const urls = require('./urls');
const fs = require('fs');
const {sync: mkdir} = require('mkdirp');
const path = require('path');
const {join} = path;
const term = require('./term');
const ln = fs.symlinkSync;
const icon = (p, i) => term(`./node_modules/fileicon/bin/fileicon set '${p}' '${i}'`);
const safe = p => p.toLowerCase().replace(/[\s\-\\\ \'\"\/]{1,}/gmi, '-');

axios.defaults.headers.common['x-udemy-authorization'] = process.env.auth;

const ROOT = './udemy';
const TEMP = path.join(ROOT, 'downloading');
const COURSES = path.join(ROOT, 'courses');
const ASSETS = path.join(ROOT, 'assets');
const DATA = path.join(ROOT, 'data');

let immediate = true;

let downloads = [];
let data = {};

async function download(id, p, url){
  console.log('\n');
  const parse = path.parse(p);
  const idFile = `${id}${parse.ext}`;
  const assetFile = path.join(ASSETS, idFile);
  const relative = path.join("../../../../assets", idFile);
  term(`ln -sf '${relative}' '${p}'`);
  if(fs.existsSync(p)) fs.unlinkSync(p);

  const run = () => new Promise((resolve, reject) => {
    if(fs.existsSync(assetFile)) return resolve();
    mkdir(TEMP);
    mkdir(ASSETS);
    const tempFile = path.join(TEMP, idFile);
    const out = fs.createWriteStream(tempFile);
    const req = require('request')({method:'GET',uri:url});
    let length = 100, sum = 0;
    req.pipe(out);
    req.on('response', data => length = Number(data.headers['content-length']));
    req.on('data', chunk => {
      sum += chunk.length;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      let b = "", l = 50, r = sum/length;
      for(let i = 0; i < l; i++) b += i < r * l ? "#" : "-";
      process.stdout.write(`[${b}] ${(r * 100).toFixed(2)}% - ${parse.base}`);
    });
    req.on('end', () => {
      fs.renameSync(tempFile, assetFile);
      resolve(console.log(''));
    });
  });

  downloads.push(run);

  if(immediate) return run();
  return run;
}

async function start(){
  try{
    console.log(`Downloading courses...`);
    const {data: {results: courses}} = await axios(urls.courses());
    console.log(`Found ${courses.length} courses.`);
    for(let course of courses.sort(() => Math.random() - 0.5)){
      console.log(`Downloading course: ${course.title}`);
      let {image_480x270: courseImage, published_title: courseSlug} = course;
      let coursePath = path.join(COURSES, safe(course.title));

      const {data: {results: items}} = await axios(urls.course(course.id));

      let chapterPath = coursePath;

      for(let item of items){
        let itemSlug = `${item.object_index} ${item.title}`;

        if(item._class == "chapter"){
          console.log(`\tChapter ${item.object_index}: ${item.title}`);
          chapterPath = path.join(coursePath, safe(itemSlug));

        } else if(item._class == "lecture"){
          console.log(`\t\Lecture ${item.object_index}: ${item.title}`);
          let itemPath = path.join(chapterPath, safe(itemSlug));
          mkdir(itemPath);

          let {data: asset} = await(axios(urls.asset(item.asset.id)));

          let {title: filename, thumbnail_url: thumbnail, captions} = asset;

          console.log(`\t\t\tDownloading thumbnail...`);
          await download(asset.id, path.join(
            itemPath,
            safe(`${asset.id} thumbnail.jpg`)
          ), thumbnail);

          if(asset.asset_type == "Video"){
          console.log(`\t\t\tDownloading video...`);
            let video = asset.stream_urls.Video[0].file;
            await download(asset.id, path.join(
              itemPath,
              safe(filename)
            ), video);

            for(let caption of asset.captions){
              console.log(`\t\t\tDownloading ${caption.video_label.toLowerCase()} caption...`);
              await download(caption.id, path.join(
                itemPath,
                safe(`Caption (${caption.video_label}) - ${caption.title}`)
              ), caption.url);
            }
          } else if(asset.asset_type == "Article"){
            console.log(`\t\t\tWriting article...`);
            fs.writeFileSync(path.join(
              itemPath, safe(`article-${filename}.html`)
            ), asset.body);
          }
          for(let supp of (item.supplementary_assets || [])){
            console.log(`\t\t\tDownloading supplementary asset (${supp.filename})...`);
            if(supp.asset_type == "File"){
              let {data:{download_urls:{File: [{file: fileUrl}]}}} = await(axios(urls.supp(course.id,item.id,supp.id)));
              await download(supp.id, path.join(
                itemPath,
                safe(supp.filename)
              ), fileUrl);

            } else if(supp.asset_type == "ExternalLink") {
              fs.writeFileSync(path.join(
                itemPath, safe(supp.filename) + ".json"
              ), `URL=${supp.external_url}`);
            }
          }
        }
      }
    }
    mkdir(DATA);
    fs.writeFileSync(path.join(
      DATA, safe('courses') + ".json"
    ), JSON.stringify(courses, null, 2));

    if(!immediate){
      for(let down of downloads){
        await down();
      }
    }
  } catch(e){
    console.log(e);
    start();
  }
};

start();
