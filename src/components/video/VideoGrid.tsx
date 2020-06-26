import React from 'react';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Skeleton from '@material-ui/lab/Skeleton';
import { Video } from '../../models/Video';
import Media from './Media';
import { debug } from '../../helpers/debug';

interface VideoGridProps {
  loading?: boolean;
  videos: Video[];
  maxPerChannel?: number;
  maxSkeletons?: number;
  onVideoClick: Function;
}

export default function VideoGrid(props: VideoGridProps) {
  const { videos, loading = false, maxPerChannel = 9, maxSkeletons = 9, onVideoClick } = props;
  const [preventLongPress, setPreventLongPress] = React.useState(false);
  const style = {
    grid: {
      minWidth: '428px'
    }
  };

  const handleMouseEvent = (event: any) => {
    debug(event.type, { preventLongPress: preventLongPress });
    if (event.type === 'mousedown') {
      setPreventLongPress(false); // always reset preventLongPress state on mousedown
      setTimeout(() => {
        // delay of 200 ms used here to wait for the click event
        // if it fires immediately after the mousedown event then preventLongPress value will be false, otherwise it's probably a long press click
        setPreventLongPress(true);
      }, 200);
    } else {
      if (!preventLongPress) {
        return true;
      }
      setPreventLongPress(false);
    }
    event.stopPropagation();
    event.preventDefault();
    return false;
  };

  return (
    <Grid container style={style.grid} onMouseDown={(event: any) => handleMouseEvent(event)} onClickCapture={(event: any) => handleMouseEvent(event)}>
      {(loading ? Array.from(new Array(Math.min(maxPerChannel, maxSkeletons))) : videos.slice(0, maxPerChannel)).map((item, index) => (
        <Box key={index} width={210} marginRight={0.5} marginBottom={3} draggable="false">
          {item ? (
            <Media item={item} onClick={onVideoClick}></Media>
          ) : (
            <React.Fragment>
              <Skeleton variant="rect" width={210} height={118} />
              <Box pt={0.5}>
                <Skeleton />
                <Skeleton width="60%" />
              </Box>
            </React.Fragment>
          )}
        </Box>
      ))}
    </Grid>
  );
}
