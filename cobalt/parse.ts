import axios from 'axios';
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

(async () => {
    // Strip all unnecessary data from the submission
    let start = Date.now();
    let filtered: StrippedSubmission[] = dorms
        .filter(dorm => !!dorm.is_gallery || !!dorm.is_video)
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

    const extractAssets = (submission: StrippedSubmission) => {
        let assets: DormAsset[] = [];
        
        // Reddit Video
        if (submission.media && 'reddit_video' in submission.media)
            assets.push({
                url: submission.media.reddit_video.fallback_url,
                thumbnail: submission.preview.images[0].source.url,
                width: submission.preview.images[0].source.width,
                height: submission.preview.images[0].source.height,
                author: submission.author_fullname
            });

        // Reddit Video Thumbnail
        if (submission.preview && submission.preview.images)
            assets.push(...submission.preview.images.map(image => ({
                url: image.source.url,
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
                    thumbnail: data.s.u,
                    width: data.s.x,
                    height: data.s.y,
                    author: submission.author_fullname
                })));

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
        assets: submissions.map(submission => extractAssets(submission)).flat(),
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
    console.log(`Parsed ${filtered.length} records in ${(Date.now() - start).toFixed(2)}ms.`);
})();