import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';

export interface WorkloadIssuer {
  readonly issuer: string;
  readonly issue: (claims: JWTPayload, expiresIn?: string) => Promise<string>;
  readonly forge: (claims: JWTPayload) => Promise<string>;
  readonly close: () => Promise<void>;
}

const KID = 'workload-key';

export const openWorkloadIssuer = async (): Promise<WorkloadIssuer> => {
  const signing = await generateKeyPair('RS256');
  const stranger = await generateKeyPair('RS256');
  const published = { ...(await exportJWK(signing.publicKey)), kid: KID };
  let issuer = '';

  const server = createServer((request, response) => {
    const answer = (body: unknown) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(body));
    };

    if (request.url === '/.well-known/openid-configuration') {
      answer({ issuer, jwks_uri: `${issuer}/keys` });
    } else if (request.url === '/keys') {
      answer({ keys: [published] });
    } else {
      response.statusCode = 404;
      response.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const signed =
    (key: CryptoKey) =>
    (claims: JWTPayload, expiresIn = '10m') =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setIssuer(issuer)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);

  return {
    issuer,
    issue: signed(signing.privateKey),
    forge: signed(stranger.privateKey),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};
