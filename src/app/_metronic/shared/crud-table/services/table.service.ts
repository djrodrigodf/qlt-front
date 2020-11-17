// tslint:disable:variable-name
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of, Subscription} from 'rxjs';
import {catchError, finalize, tap} from 'rxjs/operators';
import {PaginatorState} from '../models/paginator.model';
import {ITableState, TableResponseModel} from '../models/table.model';
import {BaseModel} from '../models/base.model';
import {SortState} from '../models/sort.model';
import {GroupingState} from '../models/grouping.model';
import {environment} from '../../../../../environments/environment';
import {decimalDigest} from '@angular/compiler/src/i18n/digest';

const DEFAULT_STATE: ITableState = {
    filter: {},
    paginator: new PaginatorState(),
    sorting: new SortState(),
    searchTerm: '',
    grouping: new GroupingState(),
    entityId: undefined
};

export abstract class TableService<T> {
    // Private fields
    private _items$ = new BehaviorSubject<T[]>([]);
    private _isLoading$ = new BehaviorSubject<boolean>(false);
    private _isFirstLoading$ = new BehaviorSubject<boolean>(true);
    private _tableState$ = new BehaviorSubject<ITableState>(DEFAULT_STATE);
    private _errorMessage = new BehaviorSubject<string>('');
    private _subscriptions: Subscription[] = [];

    // Getters
    get items$() {
        return this._items$.asObservable();
    }

    get isLoading$() {
        return this._isLoading$.asObservable();
    }

    get isFirstLoading$() {
        return this._isFirstLoading$.asObservable();
    }

    get errorMessage$() {
        return this._errorMessage.asObservable();
    }

    get subscriptions() {
        return this._subscriptions;
    }

    // State getters
    get paginator() {
        return this._tableState$.value.paginator;
    }

    get filter() {
        return this._tableState$.value.filter;
    }

    get sorting() {
        return this._tableState$.value.sorting;
    }

    get searchTerm() {
        return this._tableState$.value.searchTerm;
    }

    get grouping() {
        return this._tableState$.value.grouping;
    }

    protected http: HttpClient;
    // API URL has to be overrided
    API_URL = `${environment.apiUrl}/endpoint`;

    constructor(http: HttpClient) {
        this.http = http;
    }

    // CREATE
    // server should return the object with ID
    create(item: BaseModel): Observable<BaseModel> {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        return this.http.post<BaseModel>(this.API_URL, item).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('CREATE ITEM', err);
                return of({id: undefined});
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    // READ (Returning filtered list of entities)
    find(tableState: ITableState): Observable<any> {
        let url = null;
        if (tableState.paginator != undefined) {
            const page = tableState.paginator.page;
            url = this.API_URL + '?page=' + page;
        }

        if (tableState.searchTerm != undefined) {
            url = this.API_URL + '?email=' + tableState.searchTerm;
        }
        this._errorMessage.next('');
        const head = localStorage.getItem(`${environment.appVersion}-${environment.USERDATA_KEY}`);
        return this.http.get<any>(url, {
            headers: {
                Authorization: 'Bearer ' + JSON.parse(head).access_token
            }
        }).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('FIND ITEMS', err);
                return of({items: [], total: 0});
            })
        );
    }

    getAll(): Observable<any> {
        const url = this.API_URL;
        this._errorMessage.next('');
        const head = localStorage.getItem(`${environment.appVersion}-${environment.USERDATA_KEY}`);
        return this.http.get<any>(url, {
            headers: {
                Authorization: 'Bearer ' + JSON.parse(head).access_token
            }
        }).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('FIND ITEMS', err);
                return of({items: [], total: 0});
            })
        );
    }

    getItemById(id: number): Observable<BaseModel> {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const url = `${this.API_URL}/${id}`;
        return this.http.get<BaseModel>(url).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('GET ITEM BY IT', id, err);
                return of({id: undefined});
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    // UPDATE
    update(item: BaseModel): Observable<any> {
        const url = `${this.API_URL}/${item.id}`;
        this._isLoading$.next(true);
        this._errorMessage.next('');
        return this.http.put(url, item).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('UPDATE ITEM', item, err);
                return of(item);
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    // UPDATE Status
    updateStatusForItems(ids: number[], status: number): Observable<any> {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const body = {ids, status};
        const url = this.API_URL + '/updateStatus';
        return this.http.put(url, body).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('UPDATE STATUS FOR SELECTED ITEMS', ids, status, err);
                return of([]);
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    // DELETE
    delete(id: any): Observable<any> {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const url = `${this.API_URL}/${id}`;
        return this.http.delete(url).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('DELETE ITEM', id, err);
                return of({});
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    // delete list of items
    deleteItems(ids: number[] = []): Observable<any> {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const url = this.API_URL + '/deleteItems';
        const body = {ids};
        return this.http.put(url, body).pipe(
            catchError(err => {
                this._errorMessage.next(err);
                console.error('DELETE SELECTED ITEMS', ids, err);
                return of([]);
            }),
            finalize(() => this._isLoading$.next(false))
        );
    }

    public fetchPage(tableState: any) {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const request = this.find(tableState)
            .pipe(
                tap((res) => {
                    this._items$.next(res.data);
                    this.patchStateWithoutFetch({
                        paginator: this._tableState$.value.paginator.recalculatePaginator(
                            res.total
                        ),
                    });
                }),
                catchError((err) => {
                    this._errorMessage.next(err);
                    return of({
                        items: [],
                        total: 0
                    });
                }),
                finalize(() => {
                    this._isLoading$.next(false);
                    const itemIds = this._items$.value.map((el: T) => {
                        const item = (el as unknown) as BaseModel;
                        return item.id;
                    });
                    this.patchStateWithoutFetch({
                        grouping: this._tableState$.value.grouping.clearRows(itemIds),
                    });
                })
            )
            .subscribe();
        this._subscriptions.push(request);
    }

    public fetch() {
        this._isLoading$.next(true);
        this._errorMessage.next('');
        const request = this.getAll()
            .pipe(
                tap((res) => {
                    this._items$.next(res.data);
                    this.patchStateWithoutFetch({
                        paginator: this._tableState$.value.paginator.recalculatePaginator(
                            res.total
                        ),
                    });
                }),
                catchError((err) => {
                    this._errorMessage.next(err);
                    return of({
                        data: [],
                        total: 0
                    });
                }),
                finalize(() => {
                    this._isLoading$.next(false);
                    const itemIds = this._items$.value.map((el: T) => {
                        const item = (el as unknown) as BaseModel;
                        return item.id;
                    });
                    this.patchStateWithoutFetch({
                        grouping: this._tableState$.value.grouping.clearRows(itemIds),
                    });
                })
            )
            .subscribe();
        this._subscriptions.push(request);
    }

    // Base Methods
    public patchState(patch: Partial<ITableState>) {
        this.patchStateWithoutFetch(patch);
        this.fetchPage(patch);
    }

    public patchStateWithoutFetch(patch: Partial<ITableState>) {
        const newState = Object.assign(this._tableState$.value, patch);
        this._tableState$.next(newState);
    }
}
