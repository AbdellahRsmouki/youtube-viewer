import React from 'react';
import Box from '@material-ui/core/Box';
import { makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import YouTubeIcon from '@material-ui/icons/YouTube';
import Link from '@material-ui/core/Link';
import Avatar from '@material-ui/core/Avatar';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import Tooltip from '@material-ui/core/Tooltip';
import { Video } from '../../models/Video';
import { Channel } from '../../models/Channel';
import { Settings } from '../../models/Settings';
import VideoGrid from './VideoGrid';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';

const useStyles = makeStyles((theme: Theme) => ({
  breadcrumb: {
    marginBottom: theme.spacing(2.5),
  },
  divider: {
    marginBottom: theme.spacing(2.5),
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    outline: 'none',
    '&:hover': {
      backgroundColor: 'transparent'
    },
  },
  title: {
    marginLeft: theme.spacing(1),
  },
  youtube: {
    '& :hover': {
      color: '#f44336',
    },
  },
  box: {
    '& :last-child': {
      '& hr.divider': {
        display: 'none'
      }
    }
  }
}));

interface MultiVideoGridProps {
  loading?: boolean;
  channels: Channel[];
  videos: Video[];
  settings: Settings;
  maxPerChannel?: number;
  onSelect: Function;
  onVideoClick: Function;
  onSave: Function;
  onRefresh: Function;
}

export default function MultiVideoGrid(props: MultiVideoGridProps) {
  const classes = useStyles();
  const theme = useTheme();
  const { channels, videos, settings, loading = false, maxPerChannel = 9, onSelect, onVideoClick, onSave, onRefresh } = props;
  const [expandedChannelsIndexes, setExpandedChannelsIndexes] = React.useState<number[]>([]);

  const hideChannel = (channel: Channel) => {
    channels.forEach((c: Channel) => {
      if (c.id === channel.id) {
        c.isHidden = true;
        onSave([...channels]);
        onRefresh();
        return;
      }
    });
  };

  const onChannelNameClick = (event: any, channel: Channel, index: number) => {
    if (!settings?.openChannelsOnNameClick) {
      event.preventDefault();
      onSelect(channel, index);
    }
  };

  return (
    <Box overflow="hidden" className={classes.box}>
      {channels.map((channel: Channel, index: number) => {
        if (channel.isHidden) {
          // eslint-disable-next-line
          return;
        }
        const channelVideos: Video[] = videos.filter((video: Video) => video.channelId === channel.id);
        // hide empty channels
        if (!loading && settings.hideEmptyChannels && channelVideos.length === 0) {
          // eslint-disable-next-line
          return;
        }
        return (
          <Box key={index}>
            <Breadcrumbs aria-label="breadcrumb" className={classes.breadcrumb}>
              <Link color="inherit" className={classes.link} href={channel.url} target="_blank" rel="noopener" onClick={(event: any) => onChannelNameClick(event, channel, index)}>
                <Avatar alt={channel.title} src={channel.thumbnail} />
                <Typography variant="subtitle1" color="textPrimary" className={classes.title}>
                  {channel.title}
                </Typography>
              </Link>
              {!settings?.openChannelsOnNameClick && 
                <Link color="inherit" className={`${classes.link} ${classes.youtube}`} href={channel.url} target="_blank" rel="noopener">
                  <Tooltip title="Open channel" aria-label="open-channel">
                    <YouTubeIcon />
                  </Tooltip>
                </Link>
              }
              <IconButton size="small" className={classes.link} onClick={() => hideChannel(channel)}>
                <Tooltip title="Hide channel" aria-label="hide-channel">
                  <VisibilityOffIcon />
                </Tooltip>
              </IconButton>
            </Breadcrumbs>
            <VideoGrid videos={expandedChannelsIndexes.indexOf(index) > -1 ? channelVideos : channelVideos.slice(0, 3)} loading={loading} maxPerChannel={maxPerChannel} maxSkeletons={3} onVideoClick={onVideoClick} />
            {channelVideos.length > 3 && expandedChannelsIndexes.indexOf(index) === -1 &&
              <Tooltip title="Show more" aria-label="show-more">
                <IconButton edge="end" aria-label="show-more" size="small" style={{ marginBottom: theme.spacing(2.5) }} onClick={() => setExpandedChannelsIndexes([...expandedChannelsIndexes, index])}>
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            }
            <Divider className={`divider ${classes.divider}`} />
          </Box>
      )}
    )}
    </Box>
  );
}