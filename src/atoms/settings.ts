import { atom } from 'jotai';
import { ChannelSelection } from '../models/Channel';
import { Settings } from '../models/Settings';

export const defaultSettings: Settings = {
  defaultChannelSelection: ChannelSelection.All,
  videosPerChannel: 9,
  videosAnteriority: 30, // days
  sortVideosBy: 'date',
  autoVideosCheckRate: 30, // minutes
  enableRecentVideosNotifications: true,
  autoPlayVideos: false,
  openVideosInInactiveTabs: false,
  openChannelsOnNameClick: false,
  hideEmptyChannels: true,
  autoCloseDrawer: false,
  autoClearRecentVideos: true,
  autoRemoveWatchLaterVideos: true,
  autoClearCache: false
};

export const settingsAtom = atom(defaultSettings);
