module.exports.courses = () => `https://www.udemy.com/api-2.0/users/me/subscribed-courses?fields%5Bcourse%5D=@min,visible_instructors,image_240x135,image_480x270,favorite_time,archive_time,completion_ratio,last_accessed_time,enrollment_time,is_practice_test_course,features,num_collections,published_title&fields%5Buser%5D=@min,job_title&ordering=-access_time,-enrolled&page=1&page_size=99999`;

module.exports.course = id => `https://www.udemy.com/api-2.0/courses/${id}/cached-subscriber-curriculum-items?fields%5Basset%5D=@min,title,filename,asset_type,external_url,length,status&fields%5Bchapter%5D=@min,description,object_index,title,sort_order&fields%5Blecture%5D=@min,object_index,asset,supplementary_assets,sort_order,is_published,is_free&fields%5Bpractice%5D=@min,object_index,title,sort_order,is_published&fields%5Bquiz%5D=@min,object_index,title,sort_order,is_published&page_size=9999`;

module.exports.asset = id => `https://www.udemy.com/api-2.0/assets/${id}?fields[asset]=@min,status,delayed_asset_message,processing_errors,time_estimation,stream_urls,thumbnail_url,captions,thumbnail_sprite,body`;

module.exports.supp = (courseId, lecId, suppId) => `https://www.udemy.com/api-2.0/users/me/subscribed-courses/${courseId}/lectures/${lecId}/supplementary-assets/${suppId}?fields%5Basset%5D=download_urls`;
