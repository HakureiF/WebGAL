import { ISentence } from '@/Core/controller/scene/sceneInterface';
import { logger } from '@/Core/util/logger';
import { webgalStore } from '@/store/store';
import { setStage } from '@/store/stageReducer';
import { getSentenceArgByKey } from '@/Core/util/getSentenceArg';
import { IStageState } from '@/store/stageInterface';
import {
  audioContextWrapper,
  getAudioLevel,
  performBlinkAnimation,
  performMouthAnimation,
  updateThresholds,
} from '@/Core/gameScripts/vocal/vocalAnimation';
import { match } from '../../util/match';
import { WebGAL } from '@/Core/WebGAL';
import {parseInt} from "lodash";
import {end} from "@/Core/gameScripts/end";



const generateSineFunction = (a: number, b: number, periods: number, amplitude: number) => {
  const periodLength = (b - a) / periods;
  const frequency = 2 * Math.PI / periodLength;

  return (x: number): number => {
    if (x < a || x > b) {
      return 0; // 超出区间返回0
    }
    // 使用 sin^2 函数确保非负性
    return Math.floor(50 * amplitude * Math.sin(frequency * (x - a)) ** 2);
  };
}


export const defaltMouthOpen = (sentence: ISentence, startTime: number, endDelay: number) => {
  const performInitName = 'mouth-open';
  let currentStageState: IStageState;
  currentStageState = webgalStore.getState().stage;
  let pos = '';
  let key = '';
  const figureAssociatedAnimation = currentStageState.figureAssociatedAnimation;
  let currentMouthValue = 0;
  const lerpSpeed = 1;
  audioContextWrapper.defaultMouthLevel = []

  for (const e of sentence.args) {
    if (e.value === true) {
      match(e.key)
        .with('left', () => {
          pos = 'left';
        })
        .with('right', () => {
          pos = 'right';
        })
        .endsWith('center', () => {
          pos = 'center';
        });
    }
    if (e.key === 'figureId') {
      key = `${e.value.toString()}`;
    }
  }

  if (pos === '' && key === '') return;

  const preArray = sentence.content.split('');
  const charArray = [];
  for (let i = 0; i < preArray.length; i++) {
    if ((preArray[i] === '.' || preArray[i] === '。') && ((preArray[i-1] === '.' || preArray[i-1] === '。'))) {
      charArray.push(preArray[i]);
      charArray.push(preArray[i]);
      charArray.push(preArray[i]);
    }
    charArray.push(preArray[i]);
  }
  charArray.push('。')
  console.log(charArray)

  let j = 0;
  let msPerFreme = 50;
  let totalFrame = endDelay/msPerFreme;
  for (let i = 0; i < charArray.length; i++) {
    let isAlpha_i = /[\p{P}\p{S}]/u.test(charArray[i])
    let isAlpha_j = /[\p{P}\p{S}]/u.test(charArray[j])
    if (isAlpha_j !== isAlpha_i) {
      const levelArray = []
      let end = (i-j) * totalFrame/charArray.length;
      if (isAlpha_j) {
        for (let k = 0; k < end; k++) {
          levelArray.push(0);
        }
        console.log("标点闭嘴")
        console.log(j, i)
      } else {
        console.log("end", end)
        let periods = (end/10) - (end/10)%0.5;
        let amplitude1 = 1;
        let levelFunc1 = generateSineFunction(0, end, periods, amplitude1);

        // let a2 = Math.random() * end / 3;
        let amplitude2 = 0.5 + Math.random() * 0.5;
        let levelFunc2 = generateSineFunction(0, end, periods, amplitude2);

        // let b3 = end - Math.random() * end / 3;
        let amplitude3 = 0.5 +Math.random() * 0.5;
        let levelFunc3 = generateSineFunction(0, end, periods, amplitude3);

        for (let k =0; k < end; k++) {
          levelArray.push(levelFunc1(k) + levelFunc2(k) + levelFunc3(k));
        }

        // let periods = (i - j)/4;
        // let start = j
        //
        // let a1 = j, b1 = i;
        // let amplitude1 = 1;
        // let levelFunc1 = generateSineFunction(a1, b1, periods, amplitude1);
        //
        // let a2 = j, b2 = i;
        // let amplitude2 = 0.5 + Math.random() * 0.5;
        // let levelFunc2 = generateSineFunction(a2, b2, periods, amplitude2);
        //
        // let a3 = j, b3 = i;
        // let amplitude3 = 0.5 +Math.random() * 0.5;
        // let levelFunc3 = generateSineFunction(a3, b3, periods, amplitude3);
        //
        // for (let k = j*4; k < i*4; k++) {
        //   levelArray.push(levelFunc1(k/4) + levelFunc2(k/4) + levelFunc3(k/4));
        // }
        console.log("非标点张嘴")
        console.log(j, i)
      }
      console.log(levelArray)
      audioContextWrapper.defaultMouthLevel.push(...levelArray)
      j = i;
    }
  }
  console.log(audioContextWrapper.defaultMouthLevel)


  return {
    arrangePerformPromise: new Promise(resolve => {
      setTimeout(() => {
        const perform = {
          performName: performInitName,
          duration: 1000 * 60 * 60,
          isOver: false,
          isHoldOn: false,
          stopFunction: () => {
            clearInterval(audioContextWrapper.defaultMouthInterval);
            key = key ? key : `fig-${pos}`;
            const animationItem = figureAssociatedAnimation.find((tid) => tid.targetId === key);
            performMouthAnimation({
              audioLevel: 0,
              OPEN_THRESHOLD: 1,
              HALF_OPEN_THRESHOLD: 1,
              currentMouthValue,
              lerpSpeed,
              key,
              animationItem,
              pos,
            });
            clearTimeout(audioContextWrapper.blinkTimerID);
          },
          blockingNext: () => false,
          blockingAuto: () => false,
          skipNextCollect: true,
          stopTimeout: undefined, // 暂时不用，后面会交给自动清除
        };
        WebGAL.gameplay.performController.arrangeNewPerform(perform, sentence, false);
        key = key ? key : `fig-${pos}`;
        const animationItem = figureAssociatedAnimation.find((tid) => tid.targetId === key);

        setTimeout(() => {
          clearInterval(audioContextWrapper.defaultMouthInterval);
          performMouthAnimation({
            audioLevel: 0,
            OPEN_THRESHOLD: 1,
            HALF_OPEN_THRESHOLD: 1,
            currentMouthValue,
            lerpSpeed,
            key,
            animationItem,
            pos,
          });
        }, endDelay);

        audioContextWrapper.defaultMouthInterval = setInterval(() => {
          const nowTime = new Date().getTime();
          let audioLevel = 0;
          let tmp = Math.floor((nowTime - startTime)/msPerFreme);
          if (tmp < audioContextWrapper.defaultMouthLevel.length) {
            audioLevel = audioContextWrapper.defaultMouthLevel[tmp];
            // console.log((nowTime - startTime))
            // console.log(endDelay)
            const { OPEN_THRESHOLD, HALF_OPEN_THRESHOLD } = updateThresholds(audioLevel);
            performMouthAnimation({
              audioLevel,
              OPEN_THRESHOLD,
              HALF_OPEN_THRESHOLD,
              currentMouthValue,
              lerpSpeed,
              key,
              animationItem,
              pos,
            });
          }
        }, msPerFreme);

        // blinkAnimation
        let animationEndTime: number;

        // 10sec
        animationEndTime = Date.now() + 10000;
        performBlinkAnimation({ key, animationItem, pos, animationEndTime });

        // 10sec
        setTimeout(() => {
          clearTimeout(audioContextWrapper.blinkTimerID);
        }, 10000);
      }, 1)
    })
  }
}

/**
 * 播放一段语音
 * @param sentence 语句
 */
export const playVocal = (sentence: ISentence) => {
  logger.debug('play vocal');
  const performInitName = 'vocal-play';
  const url = getSentenceArgByKey(sentence, 'vocal'); // 获取语音的url
  const volume = getSentenceArgByKey(sentence, 'volume'); // 获取语音的音量比
  let currentStageState: IStageState;
  currentStageState = webgalStore.getState().stage;
  let pos = '';
  let key = '';
  const freeFigure = currentStageState.freeFigure;
  const figureAssociatedAnimation = currentStageState.figureAssociatedAnimation;
  let bufferLength = 0;
  let currentMouthValue = 0;
  const lerpSpeed = 1;

  // 先停止之前的语音
  let VocalControl: any = document.getElementById('currentVocal');
  WebGAL.gameplay.performController.unmountPerform('vocal-play', true);
  if (VocalControl !== null) {
    VocalControl.currentTime = 0;
    VocalControl.pause();
  }

  for (const e of sentence.args) {
    if (e.value === true) {
      match(e.key)
        .with('left', () => {
          pos = 'left';
        })
        .with('right', () => {
          pos = 'right';
        })
        .endsWith('center', () => {
          pos = 'center';
        });
    }
    if (e.key === 'figureId') {
      key = `${e.value.toString()}`;
    }
  }

  // 获得舞台状态
  webgalStore.dispatch(setStage({ key: 'playVocal', value: url }));
  webgalStore.dispatch(setStage({ key: 'vocal', value: url }));

  let isOver = false;

  /**
   * 嘴型同步
   */

  return {
    arrangePerformPromise: new Promise((resolve) => {
      // 播放语音
      setTimeout(() => {
        let VocalControl: any = document.getElementById('currentVocal');
        // 设置语音音量
        typeof volume === 'number' && volume >= 0 && volume <= 100
          ? webgalStore.dispatch(setStage({ key: 'vocalVolume', value: volume }))
          : webgalStore.dispatch(setStage({ key: 'vocalVolume', value: 100 }));
        // 设置语音
        if (VocalControl !== null) {
          VocalControl.currentTime = 0;
          // 播放并作为一个特别演出加入
          const perform = {
            performName: performInitName,
            duration: 1000 * 60 * 60,
            isOver: false,
            isHoldOn: false,
            stopFunction: () => {
              clearInterval(audioContextWrapper.audioLevelInterval);
              VocalControl.pause();
              key = key ? key : `fig-${pos}`;
              const animationItem = figureAssociatedAnimation.find((tid) => tid.targetId === key);
              performMouthAnimation({
                audioLevel: 0,
                OPEN_THRESHOLD: 1,
                HALF_OPEN_THRESHOLD: 1,
                currentMouthValue,
                lerpSpeed,
                key,
                animationItem,
                pos,
              });
              clearTimeout(audioContextWrapper.blinkTimerID);
            },
            blockingNext: () => false,
            blockingAuto: () => {
              return !isOver;
            },
            skipNextCollect: true,
            stopTimeout: undefined, // 暂时不用，后面会交给自动清除
          };
          WebGAL.gameplay.performController.arrangeNewPerform(perform, sentence, false);
          key = key ? key : `fig-${pos}`;
          const animationItem = figureAssociatedAnimation.find((tid) => tid.targetId === key);
          if (animationItem) {
            let maxAudioLevel = 0;

            const foundFigure = freeFigure.find((figure) => figure.key === key);

            if (foundFigure) {
              pos = foundFigure.basePosition;
            }

            if (!audioContextWrapper.audioContext) {
              let audioContext: AudioContext | null;
              audioContext = new AudioContext();
              audioContextWrapper.analyser = audioContext.createAnalyser();
              audioContextWrapper.analyser.fftSize = 256;
              audioContextWrapper.dataArray = new Uint8Array(audioContextWrapper.analyser.frequencyBinCount);
            }

            if (!audioContextWrapper.analyser) {
              audioContextWrapper.analyser = audioContextWrapper.audioContext.createAnalyser();
              audioContextWrapper.analyser.fftSize = 256;
            }

            bufferLength = audioContextWrapper.analyser.frequencyBinCount;
            audioContextWrapper.dataArray = new Uint8Array(bufferLength);
            let vocalControl = document.getElementById('currentVocal') as HTMLMediaElement;

            if (!audioContextWrapper.source) {
              audioContextWrapper.source = audioContextWrapper.audioContext.createMediaElementSource(vocalControl);
              audioContextWrapper.source.connect(audioContextWrapper.analyser);
            }

            audioContextWrapper.analyser.connect(audioContextWrapper.audioContext.destination);

            // Lip-snc Animation
            audioContextWrapper.audioLevelInterval = setInterval(() => {
              const audioLevel = getAudioLevel(
                audioContextWrapper.analyser!,
                audioContextWrapper.dataArray!,
                bufferLength,
              );
              // audioArray.push(audioLevel);
              // console.log(audioArray);
              const { OPEN_THRESHOLD, HALF_OPEN_THRESHOLD } = updateThresholds(audioLevel);
              performMouthAnimation({
                audioLevel,
                OPEN_THRESHOLD,
                HALF_OPEN_THRESHOLD,
                currentMouthValue,
                lerpSpeed,
                key,
                animationItem,
                pos,
              });
            }, 20);

            // blinkAnimation
            let animationEndTime: number;

            // 10sec
            animationEndTime = Date.now() + 10000;
            performBlinkAnimation({ key, animationItem, pos, animationEndTime });

            // 10sec
            setTimeout(() => {
              clearTimeout(audioContextWrapper.blinkTimerID);
            }, 10000);
          }

          VocalControl?.play();

          VocalControl.onended = () => {
            logger.debug("语音演出清空")
            for (const e of WebGAL.gameplay.performController.performList) {
              if (e.performName === performInitName) {
                isOver = true;
                e.stopFunction();
                WebGAL.gameplay.performController.unmountPerform(e.performName);
              }
            }
          };
        }
      }, 1);
    }),
  };
};
