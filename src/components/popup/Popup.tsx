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
import { getDateBefore, isInToday, diffHours } from '../../helpers/utils';
import MultiVideoGrid from '../video/MultiVideoGrid';
import VideoGrid from '../video/VideoGrid';
import { saveToStorage } from '../../helpers/storage';
import { ChannelList } from '../channel/ChannelList';
import { MessageSnackbar } from '../snackbar/MessageSnackbar';
import { SettingsDialog } from '../settings/SettingsDialog';
import { BottomSnackbar } from '../snackbar/BottomSnackbar';
import { isWebExtension } from '../../helpers/browser';
import { debug } from '../../helpers/debug';
import { useStyles } from './Popup.styles';
// @ts-ignore
import ReactPullToRefresh from 'react-pull-to-refresh';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import { useAtom } from 'jotai';
import { useUpdateAtom, useAtomValue } from 'jotai/utils';
import { channelsAtom, selectedChannelIndexAtom } from '../../atoms/channels';
import { videosAtom, videosSortOrderAtom } from '../../atoms/videos';
import { settingsAtom } from '../../atoms/settings';
import { cacheAtom } from '../../atoms/cache';
import { snackbarAtom, openSnackbarAtom, closeSnackbarAtom } from '../../atoms/snackbar';
import { SortOrder } from '../../models/SortOrder';

interface PopupProps {
  isReady: boolean;
}

export default function Popup(props: PopupProps) {
  const classes = useStyles();
  const theme = useTheme();
  const [channels, setChannels] = useAtom(channelsAtom);
  const [videos, setVideos] = useAtom(videosAtom);
  const videosSortOrder = useAtomValue(videosSortOrderAtom);
  const [openDrawer, setOpenDrawer] = React.useState(false);
  const [isReady, setIsReady] = React.useState(props.isReady);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedChannelIndex, setSelectedChannelIndex] = useAtom(selectedChannelIndexAtom);
  const [settings] = useAtom(settingsAtom);
  const [openSettingsDialog, setOpenSettingsDialog] = React.useState(false);
  const [snackbar, openSnackbar, closeSnackbar] = [useAtomValue(snackbarAtom), useUpdateAtom(openSnackbarAtom), useUpdateAtom(closeSnackbarAtom)];
  const [lastError, setLastError] = React.useState<Error|null>(null);
  const [cache, setCache] = useAtom(cacheAtom);
  const [recentVideosCount, setRecentVideosCount] = React.useState(0);
  const [todaysVideosCount, setTodaysVideosCount] = React.useState(0);
  const [watchLaterVideosCount, setWatchLaterVideosCount] = React.useState(0);

  React.useEffect(() => setIsReady(props.isReady), [props.isReady]);

  React.useEffect(() => {
    debug.warn('isReady changed', isReady);
    if (isReady) {
      if (channels.length && !videos.length) {
        showChannelSelection(settings.defaultChannelSelection, true);
      } else if (selectedChannelIndex !== settings.defaultChannelSelection) {
        setSelectedChannelIndex(settings.defaultChannelSelection);
      }
      updateVideosCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  React.useEffect(() => {
    debug.warn('channels changed', { isReady: isReady });
    if (isReady) {
      saveToStorage({ channels: channels });
      updateVideosCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  React.useEffect(() => {
    debug.warn('settings changed', { isReady: isReady });
    if (isReady) {
      saveToStorage({ settings: settings });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  React.useEffect(() => {
    debug.warn('cache changed', { isReady: isReady });
    if (isReady) {
      saveToStorage({ cache: cache });
      updateVideosCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache]);

  const updateVideosCount = () => {
    debug.log('----------------------');
    debug.log('counting videos');
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
      debug.log(channel.title, {
        recent: recentVideosCountPerChannel,
        todays: todaysVideosCountPerChannel,
        watchLater: watchLaterVideosCountPerChannel,
      });
      totalRecentVideosCount += recentVideosCountPerChannel;
      totalTodaysVideosCount += todaysVideosCountPerChannel;
      totalWatchLaterVideosCount += watchLaterVideosCountPerChannel;
    });
    debug.log('total count', {
      recent: totalRecentVideosCount,
      todays: totalTodaysVideosCount,
      watchLater: totalWatchLaterVideosCount,
    });
    setRecentVideosCount(totalRecentVideosCount);
    setTodaysVideosCount(totalTodaysVideosCount);
    setWatchLaterVideosCount(totalWatchLaterVideosCount);
  };

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

  /**
   * Get a specific channel videos
   * 
   * @param channel channel object
   * @param ignoreCache boolean value that defines if the cache should be ignored
   * @param pipeFunction pipe function can be used to filter videos before they get sliced, by default it does nothing more than returning the original videos array
   */
  const getChannelVideos = (
    channel: Channel,
    ignoreCache: boolean = false,
    pipeFunction: ((channelVideos: Video[]) => Video[]) = (channelVideos: Video[]) => channelVideos
  ): Promise<Video[]> => {
    return new Promise((resolve, reject) => {
      if (!ignoreCache && cache[channel.id]?.length) {
        debug.log('----------------------');
        debug.log('load videos from cache', channel.title, cache[channel.id]);
        resolve(pipeFunction(cache[channel.id]).slice(0, settings.videosPerChannel));
      } else {
        getChannelActivities(channel.id, getDateBefore(settings.videosAnteriority)).then((results) => {
          debug.log('----------------------');
          debug.log('activities of', channel.title, results);
          if (results?.items) {
            // get recent videos ids
            const videosIds: string[] = results.items.map((item: any) => item.contentDetails.upload?.videoId).filter((id: string) => id?.length);
            const cacheVideosIds: string[] = cache[channel.id]?.length ? cache[channel.id].map((video: Video) => video.id) : [];
            const recentVideosIds: string[] = videosIds.filter((videoId: string, index: number) => videosIds.indexOf(videoId) === index) // remove duplicates
                                                       .slice(0, settings.videosPerChannel)
                                                       .filter((videoId: string) => cacheVideosIds.indexOf(videoId) === -1); // remove videos already in cache
            // get recent videos informations
            if (!recentVideosIds.length) {
              debug.log('no recent videos for this channel');
              resolve(pipeFunction(cache[channel.id])?.slice(0, settings.videosPerChannel) || []);
            } else {
              debug.log('getting recent videos of', channel.title, { recentVideosIds: recentVideosIds, cacheVideosIds: cacheVideosIds });
              getVideoInfo(recentVideosIds).then((videosData: Video[]) => {
                debug.log('recent videos data', videosData);
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
                const sortedVideos = cache[channel.id].sort((a: Video, b: Video) => {
                  if (settings.sortVideosBy === 'views' && a.views?.count && b.views?.count) {
                    return b.views.count - a.views.count;
                  } else {
                    return b.publishedAt - a.publishedAt;
                  }
                });
                // save to cache
                setCache({...cache});
                resolve(pipeFunction(sortedVideos)?.slice(0, settings.videosPerChannel) || []);
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
    debug.log('added channel:', channel);
    const found: Channel | undefined = channels.find((c: Channel) => c.id === channel.id);
    if (!found) {
      setChannels([...channels, channel]);
      setSelectedChannelIndex(channels.length);
    } else {
      setSelectedChannelIndex(channels.indexOf(found));
    }
    // Get channel videos
    setIsLoading(true);
    getChannelVideos(channel).then((results: Video[]) => {
      setVideos(results || []);
      setIsLoading(false);
    });
  };

  const selectChannel = (channel: Channel, index: number, ignoreCache: boolean = false, sortOrder?: SortOrder) => {
    // Select channel
    debug.log('selected channel:', channel);
    setSelectedChannelIndex(index);
    if (sortOrder === undefined || sortOrder === null) {
      sortOrder = videosSortOrder[index]; // == undefined if videosSortOrder[index] is not yet set
    }
    // Get its videos
    setIsLoading(true);
    return getChannelVideos(channel, ignoreCache).then((results: Video[]) => {
      if (sortOrder) {
        results = results.sort(getSortFunction(sortOrder));
      }
      setVideos(results || []);
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

  const fetchChannelsVideos = (
    selection: ChannelSelection,
    filterFunction: ((video: Video) => boolean|undefined)|null = null,
    sortFunction: ((a: Video, b: Video) => number)|null = null,
    ignoreCache: boolean = false,
    customChannels?: Channel[]
  ) => {
    // Update channel selection
    setSelectedChannelIndex(selection);
    // Get channels videos
    setIsLoading(true);
    setVideos([]);
    let promises: Promise<any>[] = [];
    let results: Video[] = [];
    const channelsList = customChannels || channels;

    channelsList.filter((channel: Channel) => !channel.isHidden).forEach((channel: Channel) => {

      const promise = getChannelVideos(channel, ignoreCache, (channelVideos: Video[]) => {
        if (filterFunction) {
          return channelVideos?.filter(filterFunction);
        } else {
          return channelVideos;
        }
      }).then((channelVideos: Video[]) => {
        debug.log('----------------------');
        debug.log(channel.title, channelVideos);
        if (sortFunction) {
          channelVideos = channelVideos.sort(sortFunction);
        }
        results.push(...channelVideos);
      });
      promises.push(promise);

    });

    return Promise.all(promises).finally(() => {
      setVideos(results);
      setIsLoading(false);
    });
  };

  const getSortFunction = (sortOrder: SortOrder) => {
    return (a: Video, b: Video) => sortOrder === SortOrder.ASC ? a.publishedAt - b.publishedAt : b.publishedAt - a.publishedAt;
  };

  const showAllChannels = (
    ignoreCache: boolean = false,
    sortOrder: SortOrder = videosSortOrder[ChannelSelection.All]
  ) => {
    return fetchChannelsVideos(ChannelSelection.All, null, getSortFunction(sortOrder), ignoreCache);
  };

  const showTodaysVideos = (
    ignoreCache: boolean = false,
    sortOrder: SortOrder = videosSortOrder[ChannelSelection.TodaysVideos]
  ) => {
    return fetchChannelsVideos(ChannelSelection.TodaysVideos, (video: Video) => isInToday(video.publishedAt), getSortFunction(sortOrder), ignoreCache);
  };

  const showRecentVideos = (
    ignoreCache: boolean = false,
    sortOrder: SortOrder = videosSortOrder[ChannelSelection.RecentVideos]
  ) => {
    return fetchChannelsVideos(ChannelSelection.RecentVideos, (video: Video) => video.isRecent, getSortFunction(sortOrder), ignoreCache);
  };

  const showWatchLaterVideos = (
    ignoreCache: boolean = false,
    sortOrder: SortOrder = videosSortOrder[ChannelSelection.WatchLaterVideos]
  ) => {
    return fetchChannelsVideos(ChannelSelection.WatchLaterVideos, (video: Video) => video.isToWatchLater, getSortFunction(sortOrder), ignoreCache);
  };

  const showChannelSelection = (selection: ChannelSelection, ignoreCache: boolean = false, sortOrder?: SortOrder) => {
    switch(selection) {
      case ChannelSelection.TodaysVideos:
        return showTodaysVideos(ignoreCache, sortOrder);
      case ChannelSelection.RecentVideos:
        return showRecentVideos(ignoreCache, sortOrder);
      case ChannelSelection.WatchLaterVideos:
        return showWatchLaterVideos(ignoreCache, sortOrder);
      case ChannelSelection.All:
      default:
        return showAllChannels(ignoreCache, sortOrder);
    }
  };

  const bulkUpdateVideos = (updateFunction: (video: Video) => void, callback?: () => void) => {
    Object.keys(cache).forEach((channelId: string) => {
      cache[channelId] = cache[channelId].map((video: Video) => {
        updateFunction(video);
        return video;
      });
    });
    setCache({...cache});
    if (callback) {
      callback();
    }
  };

  const clearRecentVideos = () => {
    bulkUpdateVideos((video: Video) => video.isRecent = false, () => {
      if (selectedChannelIndex === ChannelSelection.RecentVideos) {
        refreshChannels(ChannelSelection.RecentVideos);
      }
    });
  };

  const clearWatchLaterVideos = () => {
    bulkUpdateVideos((video: Video) => video.isToWatchLater = false, () => {
      if (selectedChannelIndex === ChannelSelection.WatchLaterVideos) {
        setVideos([]);
      }
    });
  };

  const refreshChannels = (selection?: ChannelSelection, event?: any, sortOrder?: SortOrder) => {
    if (event) {
      event.stopPropagation();
    }
    if (selection === undefined || selection === null) {
      selection = selectedChannelIndex;
    }
    if (selection >= 0) {
      return selectChannel(channels[selection], selection, true, sortOrder);
    } else {
      return showChannelSelection(selection, true, sortOrder);
    }
  };

  const importChannels = (channelsList: Channel[]) => {
    debug.log('importing channels', channelsList);
    // Update channels
    setChannels(channelsList);
    fetchChannelsVideos(ChannelSelection.All, null, null, true, channelsList);
    openSnackbar({
      message: 'Channels imported!',
      icon: 'success',
      showRefreshButton: true
    });
  };

  const openSettings = (event: any) => {
    event.stopPropagation();
    setOpenSettingsDialog(true);
  };

  const closeSettings = () => {
    setOpenSettingsDialog(false);
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
      openSnackbar({
        message: 'All videos added to watch later list!',
        icon: 'success'
      });
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
          <span title="Youtube viewer" className={classes.logo}>
            <img alt="logo" src="icons/128.png" />
          </span>
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
          className={isLoading ? classes.disabled : ''}
          channels={channels}
          selectedIndex={selectedChannelIndex}
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
        onClick={() => settings.autoCloseDrawer && handleDrawerClose()}
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
                videos={videos}
                settings={settings}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
                maxVisible={isWebExtension() ? 3 : 6}
                onSelect={selectChannel}
                onSave={setChannels}
                onRefresh={refreshChannels}
              />
            ) : (
              <VideoGrid
                videos={videos}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
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
        open={openSettingsDialog}
        onClose={closeSettings}
      />
      <BottomSnackbar
        open={snackbar.isOpen}
        snackbarKey={snackbar.key}
        message={snackbar.message}
        icon={snackbar.icon}
        autoHideDuration={snackbar.autoHideDuration}
        showRefreshButton={snackbar.showRefreshButton}
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
