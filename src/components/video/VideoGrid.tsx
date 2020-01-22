import React from 'react';
import Box from '@material-ui/core/Box';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import YouTubeIcon from '@material-ui/icons/YouTube';
import Link from '@material-ui/core/Link';
import Avatar from '@material-ui/core/Avatar';
import Divider from '@material-ui/core/Divider';
import { Video } from '../../models/Video';
import { Channel } from '../../models/Channel';
import VideoList from './VideoList';

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
  },
  title: {
    marginLeft: theme.spacing(1),
  },
  anchor: {
    outline: 'none',
    color: 'inherit',
  },
}));

interface VideoGridProps {
  loading?: boolean;
  channels: Channel[];
  videos: Video[];
  maxPerLine?: number;
  maxPerChannel?: number;
  onSelect: Function;
}

export default function VideoGrid(props: VideoGridProps) {
  const classes = useStyles();
  const { channels, videos, loading = false, maxPerLine = 3, maxPerChannel = 6, onSelect } = props;

  return (
    <Box overflow="hidden">
      {channels.map((channel: Channel, index: number) => (
        <Box key={index}>
          <Breadcrumbs aria-label="breadcrumb" className={classes.breadcrumb}>
            <Avatar>
              <a href={channel.url} className={classes.anchor} target="_blank" rel="noopener noreferrer">
                <YouTubeIcon />
              </a>
            </Avatar>
            <Link color="inherit" onClick={() => onSelect(channel, index)} className={classes.link}>
              <Avatar alt={channel.title} src={channel.thumbnail} />
              <Typography variant="subtitle1" color="textPrimary" className={classes.title}>
                {channel.title}
              </Typography>
            </Link>
          </Breadcrumbs>
          <VideoList videos={videos.filter((video: Video) => video.channelId === channel.id)} loading={loading} maxPerLine={maxPerLine} maxPerChannel={maxPerChannel} />
          {index < channels.length - 1 && <Divider className={classes.divider} />}
        </Box>
      ))}
    </Box>
  );
}
