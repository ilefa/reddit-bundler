import axios from 'axios';
import dotenv from 'dotenv';
import dorms from '../UConnDorms-raw.json';

import { writeFileSync } from 'fs';

import {
    Dorm,
    DormAsset,
    DormAttribution,
    DormHallType,
    ExtractedSubmission,
    IntermediarySubmission,
    StrippedSubmission
} from './types';

dotenv.config();

(async () => {
    // Strip all unnecessary data from the submission
    let start = Date.now();
    let filtered: StrippedSubmission[] = dorms
        .filter(dorm => dorm.is_gallery
                     || dorm.is_video
                     || dorm.is_reddit_media_domain
                     || dorm.media?.oembed
                     || dorm.secure_media?.oembed)
        .map(dorm => ({
            selftext: dorm.selftext,
            title: dorm.title,
            name: dorm.name,
            upvote_ratio: dorm.upvote_ratio,
            ups: dorm.ups,
            media: dorm.media,
            media_metadata: dorm.media_metadata,
            media_embed: dorm.media_embed,
            secure_media: dorm.secure_media,
            secure_media_embed: dorm.secure_media_embed,
            author: dorm.author,
            author_fullname: dorm.author_fullname,
            score: dorm.score,
            preview: dorm.preview,
            id: dorm.id,
            url: dorm.url,
            created_utc: dorm.created_utc,
            link_flair_text: dorm.link_flair_text
        }));

    const getAvatar = async (username: string) => await axios
        .get(`https://reddit.com/user/${username}/about.json`)
        .then(res => res.data)
        .then(res => {
            let avatar = res.data.icon_img;
            if (!avatar)
                return null;

            return avatar.split('?')[0];
        })
        .catch(_ => null);

    const extractAssets = async (submission: StrippedSubmission) => {
        let assets: DormAsset[] = [];
        
        // Reddit Video
        if (submission.media && 'reddit_video' in submission.media)
            assets.push({
                url: submission.media.reddit_video.fallback_url,
                caption: submission.title,
                thumbnail: submission.preview.images[0].source.url,
                width: submission.preview.images[0].source.width,
                height: submission.preview.images[0].source.height,
                author: submission.author_fullname
            });

        // Reddit Video Thumbnail
        if (submission.preview && submission.preview.images)
            assets.push(...submission.preview.images.map(image => ({
                url: image.source.url,
                caption: submission.title,
                thumbnail: image.source.url,
                width: image.source.width,
                height: image.source.height,
                author: submission.author_fullname
            })))

        // media_metadata
        if (submission.media_metadata)
            assets.push(...Object
                .keys(submission.media_metadata)
                .map(key => submission.media_metadata[key])
                .map(data => ({
                    url: data.s.u,
                    caption: submission.title,
                    thumbnail: data.s.u,
                    width: data.s.x,
                    height: data.s.y,
                    author: submission.author_fullname
                })));

        // oembed (imgur or other attached)
        if (submission.media && submission.media?.oembed)
            assets.push({
                url: (submission.media.oembed as any).url,
                caption: submission.title,
                thumbnail: submission.media.oembed.thumbnail_url,
                width: submission.media.oembed.thumbnail_width,
                height: submission.media.oembed.thumbnail_height,
                author: submission.author_fullname
            });

        if (submission.media?.oembed && submission.secure_media?.oembed)
            assets.push({
                url: (submission.media.oembed as any).url,
                caption: submission.title,
                thumbnail: submission.media.oembed.thumbnail_url,
                width: submission.media.oembed.thumbnail_width,
                height: submission.media.oembed.thumbnail_height,
                author: submission.author_fullname
            });

        // resolve all imgur albums
        assets = await Promise.all(
            assets.map(async asset => {
                if (!asset.url.includes('imgur.com/a/'))
                    return asset;
    
                let headers = { Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}` }
                let resolved = await axios
                    .get(`https://api.imgur.com/3/album/${asset.url.split('/a/')[1]}/images`, { headers })
                    .then(res => res.data)
                    .then(({ data }) => data.map(ent => ({
                        url: ent.link,
                        caption: asset.caption,
                        thumbnail: ent.link,
                        width: ent.width,
                        height: ent.height,
                        author: asset.author
                    })))
                    .catch(_ => []);

                if (resolved.length <= 1)
                    return resolved[0];

                return resolved;
            }));

        // get distinct assets
        assets = assets
            .flat()
            .filter(asset => !!asset)
            .filter((asset, i, self) => self
                .map(asset => asset.url)
                .indexOf(asset.url) === i);

        return assets;
    }

    const extractAttribution = async (submission: StrippedSubmission): Promise<DormAttribution> => ({
        author: {
            name: submission.author,
            avatar: await getAvatar(submission.author),
            id: submission.author_fullname,
        },
        post: {
            id: submission.id,
            url: submission.url,
            created: submission.created_utc
        }
    })

    const getResHall = (submission: StrippedSubmission) =>
        getEnumKeyByValue(DormHallType, submission.link_flair_text);

    const getEnumKeyByValue = (enumObj: any, value: string) =>
        Object
            .keys(enumObj)
            .find(key => enumObj[key].toLowerCase() === value.toLowerCase());

    const coalesce = async (submissions: StrippedSubmission[], hall: keyof typeof DormHallType): Promise<Dorm> => ({
        hall,
        assets: (await Promise.all(submissions.map(async submission => await extractAssets(submission)))).flat(),
        sources: await Promise.all(submissions.map(async submission => await extractAttribution(submission)).flat()),
    });

    const extractByKey = (items: IntermediarySubmission[], res: ExtractedSubmission) => {
        if (!items.length)
            return res;

        let target = res[items[0].key];
        if (!target) target = [];
        target.push(items[0]);

        return extractByKey(items.slice(1), res);
    }

    let intermediary = filtered.map(item => ({
        ...item,
        key: getResHall(item) as keyof typeof DormHallType
    }));

    let extracted: ExtractedSubmission = extractByKey(intermediary,
        {
            ALUMNI: [],
            BUCKLEY: [],
            BUSBY_SUITES: [],
            CHARTER_OAK_2P_2B: [],
            CHARTER_OAK_4P_2B: [],
            CHARTER_OAK_4P_4B: [],
            EAST_CAMPUS: [],
            GARRIGUS_SUITES: [],
            HILLTOP_APTS_2P_2B: [],
            HILLTOP_APTS_4P_4B: [],
            HILLTOP_APTS_DOUBLE: [],
            HILLTOP_HALLS: [],
            HUSKY_VILLAGE: [],
            MANSFIELD_APARTMENTS: [],
            MCMAHON: [],
            NORTHWEST_CAMPUS: [],
            NORTHWOOD_APTS: [],
            NORTH_CAMPUS: [],
            OFF_CAMPUS_APARTMENTS: [],
            SHIPPEE: [],
            SOUTH_CAMPUS: [],
            STAMFORD: [],
            TOWERS: [],
            WERTH: [],
            WEST_CAMPUS: [],
        });

    let final = await Promise.all(
        Object
            .keys(extracted)
            .map(key => ({ collection: extracted[key], hall: key }))
            .map(async ({ collection, hall }) => await coalesce(collection, hall as keyof typeof DormHallType)));

    final = final.filter(ent => ent.assets.length);

    writeFileSync(`${dorms[0].subreddit}.json`, JSON.stringify(final, null, 3));
    console.log(` - ${final.reduce((a, b) => a + b.assets.length, 0)} assets processed`);
    final.forEach(ent => console.log(`   > ${ent.hall} has ${ent.assets.length} asset${ent.assets.length === 1 ? '' : 's'} from ${ent.sources.length} source${ent.sources.length === 1 ? '' : 's'}`));
    console.log(` - ${filtered.length} records generated`);
    console.log(`Finished generating records in ${(Date.now() - start).toFixed(2)}ms.`);
})();