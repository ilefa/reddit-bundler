import {
    ImagePreview,
    Media,
    MediaEmbed,
    SecureMediaEmbed
} from 'snoowrap/dist/objects/Submission';

export type StrippedSubmission = {
    selftext: string;
    title: string;
    name: string;
    ups: number;
    upvote_ratio: number;
    media: Media | null;
    media_embed: MediaEmbed;
    media_metadata: any;
    secure_media: Media;
    secure_media_embed: SecureMediaEmbed;
    preview: { enabled: boolean; images: ImagePreview[] };
    author_fullname: string;
    author: string;
    score: number;
    id: string;
    url: string;
    created_utc: number;
    link_flair_text: string;
}

export type IntermediarySubmission = StrippedSubmission & {
    key: keyof typeof DormHallType;
}

export type ExtractedSubmission = {
    [key in keyof typeof DormHallType]?: IntermediarySubmission[];
}

export type Dorm = {
    hall: keyof typeof DormHallType;
    assets: DormAsset[];
    sources: DormAttribution[];
}

export type DormAsset = {
    url: string;
    thumbnail: string;
    width: number;
    height: number;
    author: string;
}

export type DormAttribution = {
    author: {
        name: string;
        avatar: string;
        id: string;
    },
    post: {
        id: string;
        url: string;
        created: number;
    }
}

export enum DormHallType {
    ALUMNI = 'Alumni',
    BUCKLEY = 'Buckley',
    HILLTOP_HALLS = 'Hilltop Halls',
    MCMAHON = 'McMahon',
    NORTH_CAMPUS = 'North Campus',
    NORTHWEST_CAMPUS = 'Northwest Campus',
    SHIPPEE = 'Shippee',
    EAST_CAMPUS = 'East Campus',
    TOWERS = 'Towers',
    WERTH = 'Werth',
    WEST_CAMPUS = 'West Campus',
    BUSBY_SUITES = 'Busby Suites',
    GARRIGUS_SUITES = 'Garrigus Suites',
    SOUTH_CAMPUS = 'South Campus',
    MANSFIELD_APARTMENTS = 'Mansfield Apartments',
    HUSKY_VILLAGE = 'Husky Village',
    CHARTER_OAK_4P_4B = 'Charter Oak - 4 Person/4 Bedroom',
    CHARTER_OAK_4P_2B = 'Charter Oak - 4 Person/2 Bedroom',
    CHARTER_OAK_2P_2B = 'Charter Oak - 2 Person/2 Bedroom',
    HILLTOP_APTS_4P_4B = 'Hilltop Apts - 4 Person/4 Bedroom',
    HILLTOP_APTS_2P_2B = 'Hilltop Apts - 2 Person/2 Bedroom',
    HILLTOP_APTS_DOUBLE = 'Hilltop Apts - Double Efficiency',
    NORTHWOOD_APTS = 'Northwood Apts',
    STAMFORD = 'Stamford',
    OFF_CAMPUS_APARTMENTS = 'Off-Campus Apartments'
} 