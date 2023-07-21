import React, {useRef, useState} from 'react';
import {
  SafeAreaView,
  KeyboardAvoidingView,
  StyleSheet,
  TextInput,
  Button,
  View,
} from 'react-native';
import {
  MediaStream,
  RTCPeerConnection,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  MediaStreamTrack,
} from 'react-native-webrtc';

import {firestoreDB} from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';

import firebase from 'firebase/compat';

function App(): JSX.Element {
  const [remoteStream, setRemoteStream] = useState<MediaStream>();
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [webcamStarted, setWebcamStarted] = useState(false);
  const [channelId, setChannelId] = useState<string>('');

  const pc = useRef<any>();
  const servers = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const startWebcam = async () => {
    pc.current = new RTCPeerConnection(servers);
    const local = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    local.getTracks().forEach(track => {
      pc.current.addTrack(track, local);
    });
    setLocalStream(local);

    const remote = new MediaStream(undefined);
    setRemoteStream(remote);

    // Push tracks from local stream to peer connection
    local.getTracks().forEach(track => {
      pc.current
        .getSenders()
        .forEach(
          (sender: {
            track: {kind: string};
            replaceTrack: (arg0: MediaStreamTrack) => void;
          }) => {
            if (sender.track && sender.track.kind === track.kind) {
              sender.replaceTrack(track);
            }
          },
        );
    });

    // Pull tracks from peer connection, add to remote video stream
    pc.current.ontrack = (event: {streams: {getTracks: () => any[]}[]}) => {
      event.streams[0].getTracks().forEach(track => {
        remote.addTrack(track);
      });
    };

    pc.current.onaddstream = (event: {
      stream: React.SetStateAction<MediaStream | undefined>;
    }) => {
      setRemoteStream(event.stream);
    };

    setWebcamStarted(true);
  };

  // const startCall = async () => {
  //   const callDoc = await addDoc(collection(firestoreDB, 'calls'), {
  //     status: 'waiting',
  //     participants: [],
  //   });

  //   const callId = callDoc.id;

  //   pc.current.onicecandidate = (event: {candidate: {toJSON: () => any}}) => {
  //     event.candidate &&
  //       updateDoc(doc(firestoreDB, 'calls', callId), {
  //         candidates: firebase.firestore.FieldValue.arrayUnion(
  //           event.candidate.toJSON(),
  //         ),
  //       });
  //   };

  //   pc.current.onnegotiationneeded = async () => {
  //     const offer = await pc.current.createOffer();
  //     await pc.current.setLocalDescription(offer);

  //     const offerData = {
  //       sdp: offer.sdp,
  //       type: offer.type,
  //     };

  //     await updateDoc(doc(firestoreDB, 'calls', callId), {
  //       offer: offerData,
  //     });
  //   };

  //   onSnapshot(doc(firestoreDB, 'calls', callId), async snapshot => {
  //     const data = snapshot.data();

  //     if (!pc.current || !data) {
  //       return;
  //     }

  //     if (data.answer) {
  //       const answer = new RTCSessionDescription(data.answer);
  //       pc.current.setRemoteDescription(answer);
  //     }

  //     if (!data.offer || pc.current.signalingState !== 'stable') {
  //       return;
  //     }

  //     const offer = new RTCSessionDescription(data.offer);
  //     pc.current.setRemoteDescription(offer);

  //     const answer = await pc.current.createAnswer();
  //     await pc.current.setLocalDescription(answer);

  //     const answerData = {
  //       sdp: answer.sdp,
  //       type: answer.type,
  //     };

  //     await updateDoc(doc(firestoreDB, 'calls', callId), {
  //       answer: answerData,
  //     });
  //   });
  // };

  const startCall = async () => {
    const callDoc = await addDoc(collection(firestoreDB, 'calls'), {
      status: 'waiting',
      participants: [],
    });

    const callId = callDoc.id;

    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = (event: {candidate: {toJSON: () => any}}) => {
      event.candidate &&
        updateDoc(doc(firestoreDB, 'calls', callId), {
          candidates: firebase.firestore.FieldValue.arrayUnion(
            event.candidate.toJSON(),
          ),
        });
    };

    const localStream = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.getTracks().forEach(track => {
      pc.current?.addTrack(track, localStream);
    });

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    const offerData = {
      sdp: offer.sdp,
      type: offer.type,
    };

    await updateDoc(doc(firestoreDB, 'calls', callId), {
      offer: offerData,
    });

    onSnapshot(doc(firestoreDB, 'calls', callId), async snapshot => {
      const data = snapshot.data();

      if (!pc.current || !data) {
        return;
      }

      if (data.answer) {
        const answer = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answer);
      }

      if (!data.offer || pc.current.signalingState !== 'stable') {
        return;
      }

      const offer = new RTCSessionDescription(data.offer);
      pc.current.setRemoteDescription(offer);

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      const answerData = {
        sdp: answer.sdp,
        type: answer.type,
      };

      await updateDoc(doc(firestoreDB, 'calls', callId), {
        answer: answerData,
      });
    });
  };

  const joinCall = async () => {
    const callDocRef = doc(firestoreDB, 'calls', channelId);
    const answerCandidatesRef = collection(
      firestoreDB,
      'calls',
      channelId,
      'answerCandidates',
    );
    const offerCandidatesRef = collection(
      firestoreDB,
      'calls',
      channelId,
      'offerCandidates',
    );

    pc.current = new RTCPeerConnection(servers);

    pc.current.onicecandidate = async (event: {
      candidate: {toJSON: () => firebase.firestore.DocumentData};
    }) => {
      if (event.candidate) {
        await addDoc(answerCandidatesRef, event.candidate.toJSON());
      }
    };

    pc.current.ontrack = (event: {streams: {getTracks: () => any[]}[]}) => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream?.addTrack(track);
      });
    };

    onSnapshot(callDocRef, (snapshot: {data: () => any}) => {
      const data = snapshot.data();
      if (!pc.current.currentRemoteDescription && data?.offer) {
        const offerDescription = new RTCSessionDescription(data.offer);
        pc.current.setRemoteDescription(offerDescription);
      }
    });

    onSnapshot(offerCandidatesRef, (snapshot: {docChanges: () => any[]}) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    const localStream = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.getTracks().forEach(track => {
      pc.current?.addTrack(track, localStream);
    });

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    const offerData = {
      sdp: offer.sdp,
      type: offer.type,
    };

    await updateDoc(doc(firestoreDB, 'calls', channelId), {
      offer: offerData,
    });

    onSnapshot(doc(firestoreDB, 'calls', channelId), async snapshot => {
      const data = snapshot.data();

      if (!pc.current || !data) {
        return;
      }

      if (data.answer) {
        const answer = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answer);
      }

      if (!data.offer || pc.current.signalingState !== 'stable') {
        return;
      }

      const offer = new RTCSessionDescription(data.offer);
      pc.current.setRemoteDescription(offer);

      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      const answerData = {
        sdp: answer.sdp,
        type: answer.type,
      };

      await updateDoc(doc(firestoreDB, 'calls', channelId), {
        answer: answerData,
      });
    });

    setLocalStream(localStream);
    setWebcamStarted(true);
  };
  return (
    <>
      <KeyboardAvoidingView style={styles.body} behavior="position">
        <SafeAreaView>
          {localStream && (
            <RTCView
              streamURL={localStream?.toURL()}
              style={styles.stream}
              objectFit="cover"
              mirror
            />
          )}

          {remoteStream && (
            <RTCView
              streamURL={remoteStream?.toURL()}
              style={styles.stream}
              objectFit="cover"
              mirror
            />
          )}
          <View style={styles.buttons}>
            {!webcamStarted && (
              <Button title="Start webcam" onPress={startWebcam} />
            )}
            {webcamStarted && <Button title="Start call" onPress={startCall} />}
            {webcamStarted && (
              <View style={{flexDirection: 'row'}}>
                <Button title="Join call" onPress={joinCall} />
                <TextInput
                  value={channelId}
                  placeholder="callId"
                  style={{borderWidth: 1, padding: 5, width: 200}}
                  onChangeText={newText => setChannelId(newText)}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainerStyle: {
    padding: 24,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#afafaf',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginVertical: 20,
    fontSize: 20,
  },
  todoItem: {
    flexDirection: 'row',
    marginVertical: 10,
    alignItems: 'center',
  },
  todoText: {
    paddingHorizontal: 5,
    fontSize: 16,
  },
  body: {
    backgroundColor: '#fff',

    justifyContent: 'center',
    alignItems: 'center',
    //@ts-ignore
    ...StyleSheet.absoluteFill,
  },
  stream: {
    flex: 2,
    width: 200,
    height: 200,
  },
  buttons: {
    alignItems: 'flex-start',
    flexDirection: 'column',
  },
});

export default App;
