import { useEffect, useMemo, useState } from 'react';
import { createPeerConnectionContext } from '../utils/PeerConnectionSession';

export const useStartPeerSession = (room, userMediaStream, localVideoRef) => {
  const peerVideoConnection = useMemo(() => createPeerConnectionContext(), []);

  const [displayMediaStream, setDisplayMediaStream] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);

  useEffect(() => {
    console.log("userMediaStream: " + JSON.stringify(userMediaStream))

    if (userMediaStream) {
      peerVideoConnection.joinRoom(room);
      peerVideoConnection.onAddUser((user) => {
        console.log(`${room}-add-user: ` + JSON.stringify(user))
        setConnectedUsers((users) => [...users, user]);
        peerVideoConnection.addPeerConnection(`${user}`, userMediaStream, (_stream) => {
          document.getElementById(user).srcObject = _stream;
        });
        peerVideoConnection.callUser(user);
      });

      peerVideoConnection.onRemoveUser((socketId) => {
        setConnectedUsers((users) => users.filter((user) => user !== socketId));
        peerVideoConnection.removePeerConnection(socketId);
      });

      console.log(`-update-user-list: `)
      peerVideoConnection.onUpdateUserList(async (users) => {
        
        setConnectedUsers(users);
        for (const user of users) {
          peerVideoConnection.addPeerConnection(`${user}`, userMediaStream, (_stream) => {
            document.getElementById(user).srcObject = _stream;
          });
        }
      }
      // console.log(`${this._room}-update-user-list: ` + JSON.stringify(users))
      );

      peerVideoConnection.onAnswerMade((socket) => peerVideoConnection.callUser(socket));

      peerVideoConnection.onInviteToRoom((id, room) => {
        console.log(`onInviteToRoom ${id}, room ${room}`);
        peerVideoConnection.joinRoom(room);
        window.open(`http://localhost:3000/${room}`);
      });
    }

    return () => {
      if (userMediaStream) {
        peerVideoConnection.clearConnections();
        userMediaStream?.getTracks()?.forEach((track) => track.stop());
      }
    };
  }, [peerVideoConnection, room, userMediaStream]);

  const cancelScreenSharing = async () => {
    const senders = await peerVideoConnection.senders.filter((sender) => sender.track.kind === 'video');

    if (senders) {
      senders.forEach((sender) =>
        sender.replaceTrack(userMediaStream.getTracks().find((track) => track.kind === 'video')),
      );
    }

    localVideoRef.current.srcObject = userMediaStream;
    displayMediaStream.getTracks().forEach((track) => track.stop());
    setDisplayMediaStream(null);
  };

  const shareScreen = async () => {
    const stream = displayMediaStream || (await navigator.mediaDevices.getDisplayMedia());

    const senders = await peerVideoConnection.senders.filter((sender) => sender.track.kind === 'video');

    if (senders) {
      senders.forEach((sender) => sender.replaceTrack(stream.getTracks()[0]));
    }

    stream.getVideoTracks()[0].addEventListener('ended', () => {
      cancelScreenSharing(stream);
    });

    localVideoRef.current.srcObject = stream;

    setDisplayMediaStream(stream);
  };

  const invitePeer = (userName) => {
    peerVideoConnection.invitePeer(userName)
  }

  return {
    connectedUsers,
    peerVideoConnection,
    shareScreen,
    cancelScreenSharing,
    isScreenShared: !!displayMediaStream,
    invitePeer,
  };
};
