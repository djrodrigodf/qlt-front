export class AuthModel {
    accessToken: string;
    refreshToken: string;
    expiresIn: Date;
  // tslint:disable-next-line:variable-name
    access_token: string;

    setAuth(auth: any) {
        this.accessToken = auth.accessToken;
        this.refreshToken = auth.refreshToken;
        this.expiresIn = auth.expiresIn;
    }
}
