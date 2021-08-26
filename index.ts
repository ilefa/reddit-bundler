import fs from 'fs';
import dotenv from 'dotenv';
import snoowrap from 'snoowrap';

import { Listing, Submission } from 'snoowrap';

dotenv.config();

(async () => {
    const subreddit = process.env.TARGET;
    const reddit = new snoowrap({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        userAgent: 'Archiver',
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD,
    });

    const target: Listing<Submission> = await reddit
        .getSubreddit(subreddit)
        .getNew({ limit: Infinity })
        .catch(_ => null);

    if (!target) {
        console.error(`Error retrieving data from the web.`);
        process.exit(0);
    }

    console.log('Retrieved %d entries from r/%s.', target.length, subreddit);
    const posts = await Promise.all(target.map(({ id }) => reddit.getSubmission(id).fetch()));
    fs.writeFileSync(`${subreddit}-raw.json`, JSON.stringify(posts, null, 3));
})();
