require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const {sync: mkdir} = require('mkdirp');
const queries = 'fields[course]=@min,visible_instructors,image_750x422,published_title,description,headline,primary_category,primary_subcategory,promo_asset&fields[asset]=@min,title,status,stream_urls,external_url,thumbnail_url,captions,body,download_urls&fields[chapter]=@min,title,object_index&fields[lecture]=@min,title,asset,supplementary_assets,object_index&fields[practice]=@min,title,object_index&fields[quiz]=@min,title,object_index&page=1&page_size=9999';

axios.defaults.headers.common['x-udemy-authorization'] = process.env.auth;

const {ROOT, TEMP, COURSES, DATA} = require('./paths');

[TEMP, COURSES, DATA].forEach(d => mkdir(d));

const get = {
  courses(){
    return axios(`https://www.udemy.com/api-2.0/users/me/subscribed-courses?${queries}`);
  },
  course(id){
    return axios(`https://www.udemy.com/api-2.0/courses/${id}/cached-subscriber-curriculum-items?${queries}`);
  }
}

getData();

async function getData(){
  const courses = (await get.courses()).data.results;

  for(let course of courses){
    console.log(course.title);
    let items = (await get.course(course.id)).data.results;
    course.items = items;
  }

  fs.writeFileSync(path.join(DATA, 'courses.json'), JSON.stringify(courses, null, 2));
}
