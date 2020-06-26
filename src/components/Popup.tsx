import React from 'react';
import clsx from 'clsx';
import { makeStyles, useTheme, Theme, createStyles } from '@material-ui/core/styles';
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
import SearchChannelInput from './channel/SearchChannelInput';
import { Channel, ChannelSelection } from '../models/Channel';
import { getChannelActivities, getVideoInfo } from '../helpers/youtube';
import { Video } from '../models/Video';
import { getDateBefore, memorySizeOf, isInToday, diffHours } from '../helpers/utils';
import MultiVideoGrid from './video/MultiVideoGrid';
import VideoGrid from './video/VideoGrid';
import { Settings } from '../models/Settings';
import { saveToStorage } from '../helpers/storage';
import { ChannelList } from './channel/ChannelList';
import { MessageSnackbar } from './shared/MessageSnackbar';
import { SettingsDialog } from './settings/SettingsDialog';
import { CustomSnackbar } from './shared/CustomSnackbar';
import { isWebExtension, isFirefox, createTab, executeScript } from '../helpers/browser';
import { debug, warn } from '../helpers/debug';
// @ts-ignore
import ReactPullToRefresh from 'react-pull-to-refresh';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';

const drawerWidth = 240;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: 'flex',
      minWidth: '700px',
      minHeight: '500px',
      maxWidth: isWebExtension() && isFirefox() ? '700px' : 'none',
    },
    appBar: {
      backgroundColor: '#f44336',
      transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
    },
    appBarShift: {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: drawerWidth,
      transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    hide: {
      display: 'none',
    },
    grow: {
      flexGrow: 1,
    },
    title: {
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'block',
      },
    },
    drawer: {
      width: drawerWidth,
      flexShrink: 0,
    },
    drawerPaper: {
      width: drawerWidth,
    },
    drawerHeader: {
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0, 1),
      ...theme.mixins.toolbar,
      justifyContent: 'flex-end',
    },
    content: {
      flexGrow: 1,
      padding: theme.spacing(3),
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      marginLeft: -drawerWidth,
    },
    contentShift: {
      transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    },
    container: {
      display: 'flex',
      width: '100%',
      height: '80%',
      justifyContent: 'center',
    },
    centered: {
      alignSelf: 'center',
      textAlign: 'center',
      margin: '0 80px'
    },
    heartIcon: {
      color: '#e25555',
      fontSize: 16,
      verticalAlign: 'middle',
    },
    madeWithLove: {
      padding: theme.spacing(1, 0),
    },
  }),
);

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
  const [lastError, setLastError] = React.useState<Error|null>(null);
  const [cache, setCache] = React.useState<any>({});
  const [recentVideosCount, setRecentVideosCount] = React.useState(0);
  const [todaysVideosCount, setTodaysVideosCount] = React.useState(0);

  React.useEffect(() => setChannels(props.channels), [props.channels]);
  React.useEffect(() => setSettings(props.settings), [props.settings]);
  React.useEffect(() => setCache(props.cache), [props.cache]);
  React.useEffect(() => setIsReady(props.isReady), [props.isReady]);

  React.useEffect(() => {
    warn('isReady changed', isReady);
    if (isReady) {
      if (channels.length && !videos.length) {
        switch(settings.defaultChannelSelection) {
          case ChannelSelection.TodaysVideos:
            showTodaysVideos(true);
            break;
          case ChannelSelection.RecentVideos:
            showRecentVideos(true);
            break;
          case ChannelSelection.All:
          default:
            showAllChannels(true);
        }
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
      let totalRecentVideosCount: number = 0, totalTodaysVideosCount: number = 0;
      Object.keys(cache).forEach((channelId: string) => {
        const channel = channels.find((c: Channel) => c.id === channelId);
        if (!channel || channel.isHidden) {
          return;
        }
        const recentVideosCountPerChannel = (cache[channelId].filter((video: Video) => video.isRecent)).length;
        const todaysVideosCountPerChannel = (cache[channelId].filter((video: Video) => isInToday(video.publishedAt))).length;
        debug(channel.title, { recent: recentVideosCountPerChannel, todays: todaysVideosCountPerChannel });
        totalRecentVideosCount += recentVideosCountPerChannel;
        totalTodaysVideosCount += todaysVideosCountPerChannel;
      });
      debug('total count', { recent: totalRecentVideosCount, todays: totalTodaysVideosCount });
      setRecentVideosCount(totalRecentVideosCount);
      setTodaysVideosCount(totalTodaysVideosCount);
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

  const refreshChannels = (selection?: ChannelSelection, event?: any) => {
    if (event) {
      event.stopPropagation();
    }
    if (selection === undefined || selection === null) {
      selection = selectedChannelIndex;
    }
    switch(selection) {
      case ChannelSelection.TodaysVideos:
        return showTodaysVideos(true);
      case ChannelSelection.RecentVideos:
        return showRecentVideos(true);
      case ChannelSelection.All:
      default:
        return showAllChannels(true);
    }
  };

  const importChannels = (channelsList: Channel[]) => {
    debug('importing channels', channelsList);
    // Update channels
    setChannels(channelsList);
    fetchChannelsVideos(ChannelSelection.All, null, true, channelsList);
    setSnackbarMessage('Channels imported!');
  };

  const clearCache = () => {
    setCache({});
    saveToStorage({ cache: {} });
    setSnackbarMessage('Cache cleared!');
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

  const saveSettings = () => {
    // Update settings
    setSettings({
      defaultChannelSelection: +(document.getElementById('defaultChannelSelection') as any).value,
      videosPerChannel: +(document.getElementById('videosPerChannel') as any).value,
      videosAnteriority: +(document.getElementById('videosAnteriority') as any).value,
      sortVideosBy: (document.getElementById('sortVideosBy') as any).value,
      apiKey: (document.getElementById('apiKey') as any).value,
      autoVideosCheckRate: +(document.getElementById('autoVideosCheckRate') as any)?.value || settings.autoVideosCheckRate,
      enableRecentVideosNotifications: (document.getElementById('enableRecentVideosNotifications') as any)?.checked || settings.enableRecentVideosNotifications,
      autoPlayVideos: (document.getElementById('autoPlayVideos') as any)?.checked || settings.autoPlayVideos,
      openVideosInInactiveTabs: (document.getElementById('openVideosInInactiveTabs') as any)?.checked || settings.openVideosInInactiveTabs,
      openChannelsOnNameClick: (document.getElementById('openChannelsOnNameClick') as any).checked,
      hideEmptyChannels: (document.getElementById('hideEmptyChannels') as any).checked,
      autoClearRecentVideos: (document.getElementById('autoClearRecentVideos') as any).checked,
      autoClearCache: (document.getElementById('autoClearCache') as any).checked
    });
    closeSettings();
    setSnackbarMessage('Settings saved!');
  };

  const closeSettingsSnackbar = () => {
    setSnackbarMessage('');
  };

  const openVideo = (event: any) => {
    event.stopPropagation();
    const videoUrl = event.currentTarget.href;
    if (isWebExtension() && videoUrl) {
      event.preventDefault();
      createTab(videoUrl, !settings.openVideosInInactiveTabs).then((tab: any) => {
        if (settings.autoPlayVideos) {
          executeScript(tab.id, `document.querySelector('#player video').play();`);
        }
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

  const getNotHiddenChannelsCount = () => {
    return channels.filter((channel: Channel) => !channel.isHidden)?.length;
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
          onShowAll={showAllChannels}
          onShowTodaysVideos={showTodaysVideos}
          onShowRecentVideos={showRecentVideos}
          onRefresh={refreshChannels}
          onSelect={selectChannel}
          onDelete={deleteChannel}
          onSave={setChannels}
          onSelectedIndexChange={setSelectedChannelIndex}
          onClearCache={clearCache}
          onClearRecentVideos={clearRecentVideos}
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
        //onClick={() => handleDrawerClose()}
      >
        <div className={classes.drawerHeader} />
        {isReady && selectedChannelIndex !== ChannelSelection.None && (channels?.length ? (
          <ReactPullToRefresh
            onRefresh={handlePullToRefresh}
            icon={(!settings.hideEmptyChannels && selectedChannelIndex < 0 && getNotHiddenChannelsCount() > 0) || videos?.length > 0 ? <ArrowDownwardIcon className="arrowicon" /> : <i></i>}
            distanceToRefresh={50}
            resistance={5}
            style={{ position: 'relative' }}
          >
            {selectedChannelIndex < 0 ? (
              <MultiVideoGrid
                channels={channels}
                videos={videos}
                settings={settings}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
                onSelect={selectChannel}
                onVideoClick={openVideo}
                onSave={setChannels}
                onRefresh={refreshChannels}
              />
            ) : (
              <VideoGrid
                videos={videos}
                loading={isLoading}
                maxPerChannel={settings.videosPerChannel}
                onVideoClick={openVideo}
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
      <SettingsDialog settings={settings} open={openSettingsDialog} onClose={closeSettings} onSave={saveSettings} />
      <CustomSnackbar open={!!snackbarMessage.length} message={snackbarMessage} onClose={closeSettingsSnackbar} onRefresh={refreshChannels} />
      <MessageSnackbar message={lastError?.message} open={!!lastError} onClose={() => setLastError(null)} />
    </div>
  )
}
