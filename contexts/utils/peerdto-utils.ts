import { Peer, PeerDTO, Profile, ProfileMessage, UserFilter } from "../../types/types";
import { User } from "../db/userdb";
import { calculateAge } from "./user-utils";

export const convertProfileToPeerDTO = (profile: Profile | null): PeerDTO | null => {
  if (
    profile &&
    profile.publicKey &&
    profile.birthDay &&
    profile.birthMonth &&
    profile.birthYear &&
    profile.interests &&
    profile.sex &&
    profile.latitude &&
    profile.longitude
  ) {
    const peerId = profile?.peerId;
    const publicKey = profile?.publicKey!;
    const age = calculateAge(profile?.birthDay!, profile?.birthMonth!, profile?.birthYear!);
    const sex = profile?.sex as number[];
    const searching = profile?.searching;
    const x = profile?.x;
    const y = profile?.y;
    const latitude = profile?.latitude;
    const longitude = profile?.longitude;
    const peerDto = { peerId, publicKey, age, sex, searching, x, y, latitude, longitude } as PeerDTO;
    return peerDto;
  } else {
    return null;
  }
}

export const convertUserToPeerDTO = (user: User | null): PeerDTO | null => {
  if (
    user &&
    user.publicKey &&
    user.birthDay &&
    user.birthMonth &&
    user.birthYear &&
    user.interests &&
    user.interests !== Array.of() &&
    user.sex &&
    user.latitude &&
    user.longitude
  ) {
    const peerId = user?.peerId;
    const publicKey = user?.publicKey!;
    const age = calculateAge(user?.birthDay!, user?.birthMonth!, user?.birthYear!);
    const sex = user?.sex as number[];
    const searching = user?.searching;
    const x = user?.x;
    const y = user?.y;
    const latitude = user?.latitude;
    const longitude = user?.longitude;
    const peerDto = { peerId, publicKey, age, sex, searching, x, y, latitude, longitude } as PeerDTO;
    return peerDto;
  } else {
    return null;
  }
}