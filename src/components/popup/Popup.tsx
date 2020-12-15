import React from 'react';
import clsx from 'clsx';
import { useTheme } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import CssBaseline from '@material-ui/core/CssBaseline';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '@material-ui/icons/Settings';
import FavoriteRoundedIcon from '@material-ui/icons/FavoriteRounded';
import GitHubIcon from '@material-ui/icons/GitHub';
import Box from '@material-ui/core/Box';
import Link from '@material-ui/core/Link';
import Fade from '@material-ui/core/Fade';
import SearchChannelInput from '../channel/SearchChannelInput';
import { Channel, ChannelSelection } from '../../models/Channel';
import { getChannelActivities, getVideoInfo } from '../../helpers/youtube';
import { Video } from '../../models/Video';
import { getDateBefore, memorySizeOf, isInToday, diffHours } from '../../helpers/utils';
import MultiVideoGrid from '../video/MultiVideoGrid';
import VideoGrid from '../video/VideoGrid';
import { Settings, SettingsType } from '../../models/Settings';
import { saveToStorage } from '../../helpers/storage';
import { ChannelList } from '../channel/ChannelList';
import { MessageSnackbar } from '../shared/MessageSnackbar';
import { SettingsDialog } from '../settings/SettingsDialog';
import { CustomSnackbar } from '../shared/CustomSnackbar';
import { isWebExtension, createTab, executeScript } from '../../helpers/browser';
import { debug, warn } from '../../helpers/debug';
import { useStyles } from './Popup.styles';
// @ts-ignore
import ReactPullToRefresh from 'react-pull-to-refresh';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';

interface PopupProps {
  channels: Channel[];
  settings: Settings;
  cache: any;
  isReady: boolean;
}

export default function Popup(props: PopupProps) {
  const classes = useStyles();
  const theme = useTheme();
  const [channels, setChannels] = React.useState<Channel[]>(props.channels);
  const [videos, setVideos] = React.useState<Video[]>([]);
  const [openDrawer, setOpenDrawer] = React.useState(false);
  const [isReady, setIsReady] = React.useState(props.isReady);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedChannelIndex, setSelectedChannelIndex] = React.useState(ChannelSelection.All);
  const [settings, setSettings] = React.useState<Settings>(props.settings);
  const [openSettingsDialog, setOpenSettingsDialog] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');
  const [snackbarAutoHideDuration, setSnackbarAutoHideDuration] = React.useState(5000);
  const [showSnackbarRefreshButton, setShowSnackbarRefreshButton] = React.useState(true);
  const [lastError, setLastError] = React.useState<Error|null>(null);
  const [cache, setCache] = React.useState<any>({});
  const [recentVideosCount, setRecentVideosCount] = React.useState(0);
  const [todaysVideosCount, setTodaysVideosCount] = React.useState(0);
  const [watchLaterVideosCount, setWatchLaterVideosCount] = React.useState(0);

  React.useEffect(() => setChannels(props.channels), [props.channels]);
  React.useEffect(() => setSettings(props.settings), [props.settings]);
  React.useEffect(() => setCache(props.cache), [props.cache]);
  React.useEffect(() => setIsReady(props.isReady), [props.isReady]);

  React.useEffect(() => {
    warn('isReady changed', isReady);
    if (isReady) {
      if (channels.length && !videos.length) {
        showChannelSelection(settings.defaultChannelSelection, true);
      } else if (selectedChannelIndex !== settings.defaultChannelSelection) {
        setSelectedChannelIndex(settings.defaultChannelSelection);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  React.useEffect(() => {
    warn('channels changed', { isReady: isReady });
    if (isReady) {
      saveToStorage({ channels: channels });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  React.useEffect(() => {
    warn('settings changed', { isReady: isReady });
    if (isReady) {
      saveToStorage({ settings: settings });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  React.useEffect(() => {
    warn('cache or channels changed', { isReady: isReady });
    if (isReady) {
      debug('----------------------');
      debug('counting todays & recent videos');
      let totalRecentVideosCount: number = 0,
          totalTodaysVideosCount: number = 0,
          totalWatchLaterVideosCount: number = 0;
      Object.keys(cache).forEach((channelId: string) => {
        const channel = channels.find((c: Channel) => c.id === channelId);
        if (!channel || channel.isHidden) {
          return;
        }
        const recentVideosCountPerChannel = (cache[channelId].filter((video: Video) => video.isRecent)).length;
        const todaysVideosCountPerChannel = (cache[channelId].filter((video: Video) => isInToday(video.publishedAt))).length;
        const watchLaterVideosCountPerChannel = (cache[channelId].filter((video: Video) => video.isToWatchLater)).length;
        debug(channel.title, {
          recent: recentVideosCountPerChannel,
          todays: todaysVideosCountPerChannel,
          watchLater: watchLaterVideosCountPerChannel,
        });
        totalRecentVideosCount += recentVideosCountPerChannel;
        totalTodaysVideosCount += todaysVideosCountPerChannel;
        totalWatchLaterVideosCount += watchLaterVideosCountPerChannel;
      });
      debug('total count', {
        recent: totalRecentVideosCount,
        todays: totalTodaysVideosCount,
        watchLater: totalWatchLaterVideosCount,
      });
      setRecentVideosCount(totalRecentVideosCount);
      setTodaysVideosCount(totalTodaysVideosCount);
      setWatchLaterVideosCount(totalWatchLaterVideosCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, channels]);

  const handleDrawerOpen = () => {
    setOpenDrawer(true);
  };

  const handleDrawerClose = () => {
    setOpenDrawer(false);
  };

  const displayError = (error: Error) => {
    console.error(error);
    setLastError(error);
  };

  const getChannelVideos = (channel: Channel, ignoreCache: boolean = false): Promise<Video[]> => {
    return new Promise((resolve, reject) => {
      if (!ignoreCache && cache[channel.id]?.length) {
        debug('----------------------');
        debug('load videos from cache', channel.title, cache[channel.id]);
        resolve(cache[channel.id].slice(0, settings.videosPerChannel));
      } else {
        getChannelActivities(channel.id, getDateBefore(settings.videosAnteriority)).then((results) => {
          debug('----------------------');
          debug('activities of', channel.title, results);
          if (results?.items) {
            // get recent videos ids
            const videosIds: string[] = results.items.map((item: any) => item.contentDetails.upload?.videoId).filter((id: string) => id?.length);
            const cacheVideosIds: string[] = cache[channel.id]?.length ? cache[channel.id].map((video: Video) => video.id) : [];
            const recentVideosIds: string[] = videosIds.filter((videoId: string, index: number) => videosIds.indexOf(videoId) === index) // remove duplicates
                                                       .slice(0, settings.videosPerChannel)
                                                       .filter((videoId: string) => cacheVideosIds.indexOf(videoId) === -1); // remove videos already in cache
            // get recent videos informations
            if (!recentVideosIds.length) {
              debug('no recent videos for this channel');
              resolve(cache[channel.id]?.slice(0, settings.videosPerChannel) || []);
            } else {
              debug('getting recent videos of', channel.title, { recentVideosIds: recentVideosIds, cacheVideosIds: cacheVideosIds });
              getVideoInfo(recentVideosIds).then((videosData: Video[]) => {
                debug('recent videos data', videosData);
                // mark new videos as recent
                const now = new Date();
                videosData = videosData.map((video: Video) => {
                  const videoDate = new Date(video.publishedAt); // convert timestamp to Date object
                  if (diffHours(now, videoDate) <= 24) { // avoid marking too old videos as recent when cache is empty
                    video.isRecent = true;
                  }
                  return video;
                });
                // merge cached & new videos
                cache[channel.id] = cache[channel.id]?.length ? [...videosData, ...cache[channel.id]] : videosData;
                // sort videos
                const videos = cache[channel.id].sort((a: Video, b: Video) => {
                  if (settings.sortVideosBy === 'views' && a.views?.count && b.views?.count) {
                    return b.views.count - a.views.count;
                  } else {
                    return b.publishedAt - a.publishedAt;
                  }
                }).slice(0, settings.videosPerChannel);
                // save to cache
                setCache({...cache});
                saveToStorage({ cache: cache });
                resolve(videos || []);
              }).catch((error: Error) => {
                displayError(error);
                resolve([]);
              });
            }
          } else {
            resolve([]);
          }
        }).catch((error: Error) => {
          displayError(error);
          resolve([]);
        });
      }
    });
  };

  const addChannel = (channel: Channel) => {
    // Add channel
    debug('added channel:', channel);
    const found: Channel | undefined = channels.find((c: Channel) => c.id === channel.id);
    if (!found) {
      setChannels([...channels, channel]);
      setSelectedChannelIndex(channels.length);
    } else {
      setSelectedChannelIndex(channels.indexOf(found));
    }
    // Get channel videos
    setIsLoading(true);
    getChannelVideos(channel).then((videos: Video[]) => {
      setVideos(videos || []);
      setIsLoading(false);
    });
  };

  const selectChannel = (channel: Channel, index: number, ignoreCache: boolean = false) => {
    // Select channel
    debug('selected channel:', channel);
    setSelectedChannelIndex(index);
    // Get its videos
    setIsLoading(true);
    return getChannelVideos(channel, ignoreCache).then((videos: Video[]) => {
      setVideos(videos || []);
      setIsLoading(false);
      window.scrollTo(0, 0); // scroll to top
    });
  };
  
  const deleteChannel = (index: number) => {
    setChannels(channels.filter((_, i) => i !== index));
    if (selectedChannelIndex === index) {
      setVideos([]);
      setSelectedChannelIndex(ChannelSelection.None);
    }
  };

  const fetchChannelsVideos = (selection: ChannelSelection, filterFunction: Function|null = null, ignoreCache: boolean = false, customChannels?: Channel[]) => {
    // Update channel selection
    setSelectedChannelIndex(selection);
    // Get channels videos
    setIsLoading(true);
    setVideos([]);
    let promises: Promise<any>[] = [];
    let videos: Video[] = [];
    const channelsList = customChannels || channels;

    channelsList.filter((channel: Channel) => !channel.isHidden).forEach((channel: Channel) => {

      const promise = getChannelVideos(channel, ignoreCache).then((newVideos: Video[]) => {
        debug('----------------------');
        debug(channel.title, newVideos);
        if (filterFunction) {
          newVideos = newVideos.filter((video: Video) => filterFunction(video));
        }
        videos.push(...newVideos);
      });
      promises.push(promise);

    });

    return Promise.all(promises).finally(() => {
      setVideos(videos);
      setIsLoading(false);
    });
  };

  const showAllChannels = (ignoreCache: boolean = false) => {
    return fetchChannelsVideos(ChannelSelection.All, null, ignoreCache);
  };

  const showTodaysVideos = (ignoreCache: boolean = false) => {
    return fetchChannelsVideos(ChannelSelection.TodaysVideos, (video: Video) => isInToday(video.publishedAt), ignoreCache);
  };

  const showRecentVideos = (ignoreCache: boolean = false) => {
    return fetchChannelsVideos(ChannelSelection.RecentVideos, (video: Video) => video.isRecent, ignoreCache);
  };

  const showWatchLaterVideos = (ignoreCache: boolean = false) => {
    return fetchChannelsVideos(ChannelSelection.WatchLaterVideos, (video: Video) => video.isToWatchLater, ignoreCache);
  };

  const showChannelSelection = (selection: ChannelSelection, ignoreCache: boolean = false) => {
    switch(selection) {
      case ChannelSelection.TodaysVideos:
        return showTodaysVideos(ignoreCache);
      case ChannelSelection.RecentVideos:
        return showRecentVideos(ignoreCache);
      case ChannelSelection.WatchLaterVideos:
        return showWatchLaterVideos(ignoreCache);
      case ChannelSelection.All:
      default:
        return showAllChannels(ignoreCache);
    }
  };

  const clearRecentVideos = () => {
    Object.keys(cache).forEach((channelId: string) => {
      cache[channelId] = cache[channelId].map((video: Video) => {
        video.isRecent = false;
        return video;
      });
    });
    setCache({...cache});
    saveToStorage({ cache: cache });
    if (selectedChannelIndex === ChannelSelection.RecentVideos) {
      refreshChannels(ChannelSelection.RecentVideos);
    }
  };

  const clearWatchLaterVideos = () => { // ToDo: merge boilerplate code (see above function)
    Object.keys(cache).forEach((channelId: string) => {
      cache[channelId] = cache[channelId].map((video: Video) => {
        video.isToWatchLater = false;
        return video;
      });
    });
    setCache({...cache});
    saveToStorage({ cache: cache });
    if (selectedChannelIndex === ChannelSelection.WatchLaterVideos) {
      refreshChannels(ChannelSelection.WatchLaterVideos);
    }
  };

  const refreshChannels = (selection?: ChannelSelection, event?: any) => {
    if (event) {
      event.stopPropagation();
    }
    if (selection === undefined || selection === null) {
      selection = selectedChannelIndex;
    }
    if (selection >= 0) {
      return selectChannel(channels[selection], selection, true);
    } else {
      return showChannelSelection(selection, true);
    }
  };

  const importChannels = (channelsList: Channel[]) => {
    debug('importing channels', channelsList);
    // Update channels
    setChannels(channelsList);
    fetchChannelsVideos(ChannelSelection.All, null, true, channelsList);
    openSnackbar('Channels imported!');
  };

  const clearCache = () => {
    setCache({});
    saveToStorage({ cache: {} });
    openSnackbar('Cache cleared!');
  };

  const getCacheSize = () => {
    const size = memorySizeOf(cache);
    //console.log(size);
    return size;
  };

  const openSettings = (event: any) => {
    event.stopPropagation();
    setOpenSettingsDialog(true);
  };

  const closeSettings = () => {
    setOpenSettingsDialog(false);
  };

  const getSettingsValue = (id: string, type: SettingsType) => {
    const element = document.getElementById(id) as any;
    if (element) {
      switch(type) {
        case SettingsType.Number:
          return +element.value;
        case SettingsType.Boolean:
          return element.checked;
        case SettingsType.String:
        default:
          return element.value;
      }
    } else {
      return (settings as any)[id];
    }
  };

  const saveSettings = () => {
    // Update settings
    setSettings({
      defaultChannelSelection: getSettingsValue('defaultChannelSelection', SettingsType.Number),
      videosPerChannel: getSettingsValue('videosPerChannel', SettingsType.Number),
      videosAnteriority: getSettingsValue('videosAnteriority', SettingsType.Number),
      sortVideosBy: getSettingsValue('sortVideosBy', SettingsType.String),
      apiKey: getSettingsValue('apiKey', SettingsType.String),
      autoVideosCheckRate: getSettingsValue('autoVideosCheckRate', SettingsType.Number),
      enableRecentVideosNotifications: getSettingsValue('enableRecentVideosNotifications', SettingsType.Boolean),
      autoPlayVideos: getSettingsValue('autoPlayVideos', SettingsType.Boolean),
      openVideosInInactiveTabs: getSettingsValue('openVideosInInactiveTabs', SettingsType.Boolean),
      openChannelsOnNameClick: getSettingsValue('openChannelsOnNameClick', SettingsType.Boolean),
      hideEmptyChannels: getSettingsValue('hideEmptyChannels', SettingsType.Boolean),
      autoClearRecentVideos: getSettingsValue('autoClearRecentVideos', SettingsType.Boolean),
      autoClearCache: getSettingsValue('autoClearCache', SettingsType.Boolean),
    });
    closeSettings();
    openSnackbar('Settings saved!');
  };

  const openSnackbar = (message: string, duration: number = 5000, showRefreshButton: boolean = true) => {
    setSnackbarAutoHideDuration(duration);
    setShowSnackbarRefreshButton(showRefreshButton);
    setSnackbarMessage(message);
  };

  const closeSnackbar = () => {
    setSnackbarMessage('');
  };

  const openVideo = (event: Event, video: Video) => {
    event.stopPropagation();
    if (isWebExtension() && video?.url) {
      event.preventDefault();
      createTab(video.url, !settings.openVideosInInactiveTabs).then((tab: any) => {
        if (settings.autoPlayVideos) {
          executeScript(tab.id, `document.querySelector('#player video').play();`);
        }
      });
    }
    if (selectedChannelIndex === ChannelSelection.WatchLaterVideos) {
      removeVideoFromWatchLater(video);
    }
  };

  const addVideoToWatchLater = (event: Event, video: Video) => {
    event.stopPropagation();
    event.preventDefault();
    const videoIndex: number = cache[video?.channelId].findIndex((v: Video) => v.id === video?.id);
    if (videoIndex > -1) {
      if (!cache[video.channelId][videoIndex].isToWatchLater) {
        cache[video.channelId][videoIndex].isToWatchLater = true;
        setCache({...cache});
        saveToStorage({ cache: cache });
        openSnackbar('Video added to watch later list!', 1000, false);
      } else {
        openSnackbar('Video is already on watch later list!', 1000, false);
      }
    }
  };

  const removeVideoFromWatchLater = (video: Video) => {
    const videoIndex: number = cache[video?.channelId].findIndex((v: Video) => v.id === video?.id);
    if (videoIndex > -1 && cache[video.channelId][videoIndex].isToWatchLater) {
      // exclude video from shown videos
      setVideos(videos.filter((v: Video) => v.id !== video.id)); // To Fix: warning => Can't perform a React state update on an unmounted component.
      //refreshChannels(ChannelSelection.WatchLaterVideos);
      // update cache
      cache[video.channelId][videoIndex].isToWatchLater = false;
      setCache({...cache});
      saveToStorage({ cache: cache });
    }
  };

  const addAllVideosToWatchLater = () => {
    let cacheUpdated: boolean = false;
    videos.forEach((video: Video) => {
      const videoIndex: number = cache[video?.channelId].findIndex((v: Video) => v.id === video?.id);
      if (videoIndex > -1 && !cache[video.channelId][videoIndex].isToWatchLater) {
        cache[video.channelId][videoIndex].isToWatchLater = true;
        cacheUpdated = true;
      }
    });
    if (cacheUpdated) {
      setCache({...cache});
      saveToStorage({ cache: cache });
      openSnackbar('All videos added to watch later list!', 3000, false);
    }
  };

  const handlePullToRefresh = (resolve: Function, reject: Function) => {
    let promise: Promise<any>;
    if (selectedChannelIndex >= 0) {
      promise = selectChannel(channels[selectedChannelIndex], selectedChannelIndex, true);
    } else {
      promise = refreshChannels(selectedChannelIndex);
    }
    promise.then(() => {
      resolve();
    }).catch(() => {
      reject();
    });
  };

  return (
    <div className={classes.root}>
      <CssBaseline />
      <AppBar
        color="secondary"
        position="fixed"
        className={clsx(classes.appBar, {
          [classes.appBarShift]: openDrawer,
        })}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            className={clsx(classes.menuButton, openDrawer && classes.hide)}
          >
            <MenuIcon />
          </IconButton>
          <Typography className={classes.title} variant="h6" noWrap>
            Youtube viewer
          </Typography>
          <SearchChannelInput onSelect={addChannel} onError={displayError} />
          <div className={classes.grow} />
          <IconButton edge="end" aria-label="settings" color="inherit" onClick={(event) => openSettings(event)}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        className={classes.drawer}
        variant="persistent"
        anchor="left"
        open={openDrawer}
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <div className={classes.drawerHeader}>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </div>
        <Divider />
        <ChannelList
          channels={channels}
          selectedIndex={selectedChannelIndex}
          cacheSize={getCacheSize()}
          todaysVideosCount={todaysVideosCount}
          recentVideosCount={recentVideosCount}
          watchLaterVideosCount={watchLaterVideosCount}
          onShowAll={showAllChannels}
          onShowTodaysVideos={showTodaysVideos}
          onShowRecentVideos={showRecentVideos}
          onShowWatchLaterVideos={showWatchLaterVideos}
          onRefresh={refreshChannels}
          onSelect={selectChannel}
          onDelete={deleteChannel}
          onSave={setChannels}
          onSelectedIndexChange={setSelectedChannelIndex}
          onClearCache={clearCache}
          onClearRecentVideos={clearRecentVideos}
          onAddVideosToWatchLater={addAllVideosToWatchLater}
          onClearWatchLaterVideos={clearWatchLaterVideos}
          onImport={importChannels}
        />
        <div className={classes.grow} />
        <Divider />
        <Typography variant="caption" align="center" className={classes.madeWithLove}>
          Made with <FavoriteRoundedIcon className={classes.heartIcon} /> by AXeL
          <Link href="https://github.com/AXeL-dev/youtube-viewer" target="_blank" rel="noopener">
            <IconButton edge="end" size="small" aria-label="github link">
              <GitHubIcon fontSize="inherit" />
            </IconButton>
          </Link>
        </Typography>
      </Drawer>
      <main
        className={clsx(classes.content, {
          [classes.contentShift]: openDrawer,
        })}
        onClick={() => handleDrawerClose()}
      >
        <div className={classes.drawerHeader} />
        {isReady && selectedChannelIndex !== ChannelSelection.None && (channels?.length ? (
          <ReactPullToRefresh
            onRefresh={handlePullToRefresh}
            icon={<ArrowDownwardIcon className="arrowicon" />}
            distanceToRefresh={50}
            resistance={5}
            style={{ position: 'relative', height: isWebExtension() ? 'calc(100% - 64px)' : 'calc(100vh - 64px)', overflow: 'auto' }}
          >
            {videos?.length === 0 && !isLoading ? (
              <Fade in={true} timeout={1000}>
                <Box className={`${classes.container} expanded`}>
                  <Typography component="div" variant="h5" color="textSecondary" className={classes.centered} style={{ cursor: 'default' }}>
                    <VideocamOffIcon style={{ fontSize: 38, verticalAlign: 'middle' }} /> No videos available
                  </Typography>
                </Box>
              </Fade>
            ) : selectedChannelIndex < 0 ? (
              <MultiVideoGrid
                channels={channels}
                selectedChannelIndex={selectedChannelIndex}
                videos={videos}
                settings={settings}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
                onSelect={selectChannel}
                onVideoClick={openVideo}
                onVideoWatchLaterClick={addVideoToWatchLater}
                onSave={setChannels}
                onRefresh={refreshChannels}
              />
            ) : (
              <VideoGrid
                selectedChannelIndex={selectedChannelIndex}
                videos={videos}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
                onVideoClick={openVideo}
                onVideoWatchLaterClick={addVideoToWatchLater}
              />
            )}
          </ReactPullToRefresh>
        ) : (
          <Fade in={true} timeout={3000}>
            <Box className={classes.container}>
              <Typography component="div" variant="h5" color="textSecondary" className={classes.centered} style={{ cursor: 'default' }}>
                <SearchIcon style={{ fontSize: 38, verticalAlign: 'middle' }} /> Start by typing a channel name in the search box
              </Typography>
            </Box>
          </Fade>
        ))}
      </main>
      <SettingsDialog
        settings={settings}
        open={openSettingsDialog}
        onClose={closeSettings}
        onSave={saveSettings}
      />
      <CustomSnackbar
        open={!!snackbarMessage.length}
        message={snackbarMessage}
        autoHideDuration={snackbarAutoHideDuration}
        showRefreshButton={showSnackbarRefreshButton}
        onClose={closeSnackbar}
        onRefresh={refreshChannels}
      />
      <MessageSnackbar
        message={lastError?.message}
        open={!!lastError}
        onClose={() => setLastError(null)}
      />
    </div>
  )
}