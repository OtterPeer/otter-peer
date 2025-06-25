import { Peer, PeerDTO, Profile, ProfileMessage, UserFilter } from "../../types/types";
import { User } from "../db/userdb";
import { calculateAge } from "./user-utils";

export const convertProfileToPeerDTO = (profile: Profile | null): PeerDTO | null => {
  if (!profile || !profile.publicKey) {
    return null;
  }

  const peerDto: PeerDTO = {
    peerId: profile.peerId,
    publicKey: profile.publicKey,
  };

  if (profile.birthDay && profile.birthMonth && profile.birthYear) {
    peerDto.age = calculateAge(profile.birthDay, profile.birthMonth, profile.birthYear);
  }
  if (profile.sex) peerDto.sex = profile.sex as number[];
  if (profile.searching) peerDto.searching = profile.searching;
  if (profile.x !== undefined) peerDto.x = profile.x;
  if (profile.y !== undefined) peerDto.y = profile.y;
  if (profile.latitude !== undefined) peerDto.latitude = profile.latitude;
  if (profile.longitude !== undefined) peerDto.longitude = profile.longitude;

  return peerDto;
};

export const convertUserToPeerDTO = (user: User | null): PeerDTO | null => {
  if (!user || !user.publicKey) {
    return null;
  }

  const peerDto: PeerDTO = {
    peerId: user.peerId,
    publicKey: user.publicKey,
  };

  if (user.birthDay && user.birthMonth && user.birthYear) {
    peerDto.age = calculateAge(user.birthDay, user.birthMonth, user.birthYear);
  }
  if (user.sex) peerDto.sex = user.sex as number[];
  if (user.searching) peerDto.searching = user.searching;
  if (user.x !== undefined) peerDto.x = user.x;
  if (user.y !== undefined) peerDto.y = user.y;
  if (user.latitude !== undefined) peerDto.latitude = user.latitude;
  if (user.longitude !== undefined) peerDto.longitude = user.longitude;

  return peerDto;
};