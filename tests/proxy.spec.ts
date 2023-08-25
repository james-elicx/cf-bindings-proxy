import { resolve } from 'path';
import type { ColumnType, Generated } from 'kysely';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { afterAll, beforeAll, expect, suite, test } from 'vitest';
import type { UnstableDevWorker } from 'wrangler';
import { unstable_dev } from 'wrangler';
import { binding } from '../src';

suite('bindings', () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		// spawn a new dev mode worker
		worker = await unstable_dev(resolve('src/cli/template/_worker.ts'), {
			// logLevel: 'debug',
			port: 8799,
			compatibilityDate: '2023-05-22',
			experimental: {
				disableExperimentalWarning: true,
				d1Databases: [{ binding: 'D1', database_name: 'test_db', database_id: 'test_db' }],
			},
			kv: [{ binding: 'KV', id: 'test_kv' }],
			// durableObjects: [{ name: 'DO', class_name: 'test_class_name' }],
			r2: [{ binding: 'R2', bucket_name: 'test_bucket' }],
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	suite('kv', () => {
		test('put', async () => {
			await binding<KVNamespace>('KV').put('first-key', 'first-value');
			await binding<KVNamespace>('KV').put('second-key', 'second-value');
		});

		test('get', async () => {
			const firstValue = await binding<KVNamespace>('KV').get('first-key');
			expect(firstValue).toEqual('first-value');

			const secondValue = await binding<KVNamespace>('KV').get('second-key');
			expect(secondValue).toEqual('second-value');
		});

		test('list', async () => {
			const list = await binding<KVNamespace>('KV').list();

			expect(list.keys).toEqual([{ name: 'first-key' }, { name: 'second-key' }]);
		});

		test('list + get from single instance', async () => {
			const kv = binding<KVNamespace>('KV');

			const list = await kv.list();
			expect(list.keys).toEqual([{ name: 'first-key' }, { name: 'second-key' }]);

			const value = await kv.get('first-key');
			expect(value).toEqual('first-value');
		});

		test('getWithMetadata', async () => {
			const key = await binding<KVNamespace>('KV').getWithMetadata('first-key');

			expect(key).toEqual({ metadata: null, value: 'first-value', cacheStatus: null });
		});

		test('delete', async () => {
			await binding<KVNamespace>('KV').delete('first-key');

			let list = await binding<KVNamespace>('KV').list();
			expect(list.keys.length).toEqual(1);

			await binding<KVNamespace>('KV').delete('second-key');

			list = await binding<KVNamespace>('KV').list();
			expect(list.keys.length).toEqual(0);
		});
	});

	suite('d1', async () => {
		test('prepare -> run (create table)', async () => {
			const createQuery = `
				CREATE TABLE IF NOT EXISTS comments (
					id integer PRIMARY KEY AUTOINCREMENT,
					author text NOT NULL,
					body text NOT NULL,
					post_slug text NOT NULL
				);
				CREATE INDEX idx_comments_post_slug ON comments (post_slug);
			`;

			const result = await binding<D1Database>('D1').prepare(createQuery).run();
			expect(result.success).toEqual(true);
		});

		test('prepare -> bind -> run (insert)', async () => {
			const insertQueryBind = `
				INSERT INTO comments (author, body, post_slug) VALUES (?, ?, ?);
			`;

			const result = await binding<D1Database>('D1')
				.prepare(insertQueryBind)
				.bind('Jon', 'How do you use D1?', 'd1-guide')
				.run();
			expect(result.success).toEqual(true);
		});

		test('prepare -> bind -> batch (insert)', async () => {
			const insertQuery = [
				`INSERT INTO comments (author, body, post_slug) VALUES ('Markus', 'Hello there!', ?);`,
				`INSERT INTO comments (author, body, post_slug) VALUES ('Kristian', 'Great post!', ?);`,
			];

			const d1 = binding<D1Database>('D1');

			const statements = insertQuery.map((query) => d1.prepare(query).bind('hello-world'));

			const result = await d1.batch(statements);
			expect(result.map((r) => r.success)).toEqual([true, true]);
		});

		test('prepare -> bind -> all (select)', async () => {
			const selectQuery = `
				select * from comments where post_slug = ?
			`;

			const result = await binding<D1Database>('D1').prepare(selectQuery).bind('hello-world').all();

			const expected = [
				{
					author: 'Markus',
					body: 'Hello there!',
					id: 2,
					post_slug: 'hello-world',
				},
				{
					author: 'Kristian',
					body: 'Great post!',
					id: 3,
					post_slug: 'hello-world',
				},
			];

			expect(result.success).toEqual(true);
			expect(result.results).toEqual(expected);
		});

		test('prepare -> first (select count)', async () => {
			const stmt = binding<D1Database>('D1').prepare('SELECT COUNT(*) AS total FROM comments');

			const total = await stmt.first('total');
			expect(total).toEqual(3);
		});

		test('kysely -> select all', async () => {
			type KyselyDatabase = {
				comments: {
					id: Generated<number>;
					author: ColumnType<string>;
					body: ColumnType<string>;
					post_slug: ColumnType<string>;
				};
			};

			const d1 = binding<D1Database>('D1');
			const kysley = new Kysely<KyselyDatabase>({ dialect: new D1Dialect({ database: d1 }) });

			const data = await kysley.selectFrom('comments').selectAll().execute();

			const expected = [
				{ id: 1, author: 'Jon', body: 'How do you use D1?', post_slug: 'd1-guide' },
				{ id: 2, author: 'Markus', body: 'Hello there!', post_slug: 'hello-world' },
				{ id: 3, author: 'Kristian', body: 'Great post!', post_slug: 'hello-world' },
			];

			expect(data).toEqual(expected);
		});

		test('prepare -> raw (select)', async () => {
			const stmt = binding<D1Database>('D1').prepare(
				'SELECT author, post_slug FROM comments LIMIT 2',
			);

			const raw = await stmt.raw();
			expect(raw).toEqual([
				['Jon', 'd1-guide'],
				['Markus', 'hello-world'],
			]);

			expect(raw[0]).toEqual(['Jon', 'd1-guide']);
			expect(raw[1]).toEqual(['Markus', 'hello-world']);
			expect(raw[2]).toEqual(undefined);
		});

		test('prepare -> raw (sqlite_schema)', async () => {
			const stmt = binding<D1Database>('D1').prepare(
				`SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`,
			);

			const raw = await stmt.raw();
			expect(raw).toEqual([['comments']]);
		});

		test('exec (drop)', async () => {
			const dropQuery = `
				DROP TABLE comments;
			`;

			const result = await binding<D1Database>('D1').exec(dropQuery);
			expect((result as unknown as { count: number }).count).toEqual(1);

			const stmt = binding<D1Database>('D1').prepare(
				`SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`,
			);

			const raw = await stmt.raw();
			expect(raw).toEqual([]);
		});

		test('dump', async () => {
			const buffer = await binding<D1Database>('D1').dump();
			expect(buffer).toBeInstanceOf(ArrayBuffer);
		});
	});

	suite('r2', () => {
		// TODO: writeHttpMetadata, uploadPart: non-string

		test('put -> string', async () => {
			const firstFile = await binding<R2Bucket>('R2').put('first-key', 'first-value', {
				customMetadata: { source: 'test-suite', v: '1' },
			});
			const secondFile = await binding<R2Bucket>('R2').put('second-key', 'second-value', {
				customMetadata: { source: 'test-suite', v: '2' },
			});

			expect(firstFile.key).toEqual('first-key');
			expect(secondFile.key).toEqual('second-key');
		});

		test('put -> ArrayBuffer', async () => {
			const firstFile = await binding<R2Bucket>('R2').put('first-key', new ArrayBuffer(1), {
				customMetadata: { source: 'test-suite', v: '1' },
			});
			const secondFile = await binding<R2Bucket>('R2').put('second-key', new ArrayBuffer(2), {
				customMetadata: { source: 'test-suite', v: '2' },
			});

			expect(firstFile.key).toEqual('first-key');
			expect(firstFile.size).toEqual(1);

			expect(secondFile.key).toEqual('second-key');
			expect(secondFile.size).toEqual(2);
		});

		test('put -> Blob', async () => {
			const firstFile = await binding<R2Bucket>('R2').put(
				'first-key',
				new Blob([new ArrayBuffer(1)]),
				{
					customMetadata: { source: 'test-suite', v: '1' },
				},
			);
			const secondFile = await binding<R2Bucket>('R2').put(
				'second-key',
				new Blob([new ArrayBuffer(2)]),
				{
					customMetadata: { source: 'test-suite', v: '2' },
				},
			);

			expect(firstFile.key).toEqual('first-key');
			expect(firstFile.size).toEqual(1);

			expect(secondFile.key).toEqual('second-key');
			expect(secondFile.size).toEqual(2);
		});

		test('get', async () => {
			const firstValue = await binding<R2Bucket>('R2').get('first-key');
			expect(firstValue?.key).toEqual('first-key');
			expect(firstValue?.customMetadata).toEqual({
				source: 'test-suite',
				v: '1',
			});

			const secondValue = await binding<R2Bucket>('R2').get('second-key');
			expect(secondValue?.key).toEqual('second-key');
			expect(secondValue?.customMetadata).toEqual({
				source: 'test-suite',
				v: '2',
			});
		});

		test('get -> read value (text/json/arraybuffer/blob)', async () => {
			await binding<R2Bucket>('R2').put('json-key', JSON.stringify({ value: 'test' }));
			const value = await binding<R2Bucket>('R2').get('json-key');

			expect(await value?.text()).toEqual(JSON.stringify({ value: 'test' }));
			expect(await value?.json()).toEqual({ value: 'test' });

			const buffer = await value?.arrayBuffer();
			expect(buffer).toBeInstanceOf(ArrayBuffer);
			expect(Buffer.from(buffer as ArrayBuffer).toString()).toEqual(
				JSON.stringify({ value: 'test' }),
			);

			const blob = await value?.blob();
			expect(blob).toBeInstanceOf(Blob);
			expect(await blob?.text()).toEqual(JSON.stringify({ value: 'test' }));
		});

		test('list', async () => {
			const list = await binding<R2Bucket>('R2').list();

			expect(list.objects.map((obj) => ({ key: obj.key }))).toEqual([
				{ key: 'first-key' },
				{ key: 'json-key' },
				{ key: 'second-key' },
			]);
		});

		test('head', async () => {
			const firstHead = await binding<R2Bucket>('R2').head('first-key');
			expect(firstHead?.key).toEqual('first-key');
			expect(firstHead?.customMetadata).toEqual({
				source: 'test-suite',
				v: '1',
			});

			const secondHead = await binding<R2Bucket>('R2').head('second-key');
			expect(secondHead?.key).toEqual('second-key');
			expect(secondHead?.customMetadata).toEqual({
				source: 'test-suite',
				v: '2',
			});
		});

		test('delete', async () => {
			await binding<R2Bucket>('R2').delete('first-key');

			let list = await binding<R2Bucket>('R2').list();
			expect(list.objects.length).toEqual(2);

			await binding<R2Bucket>('R2').delete('second-key');

			list = await binding<R2Bucket>('R2').list();
			expect(list.objects.length).toEqual(1);

			await binding<R2Bucket>('R2').delete('json-key');

			list = await binding<R2Bucket>('R2').list();
			expect(list.objects.length).toEqual(0);
		});

		test('createMultipartUpload + resumeMultipartUpload', async () => {
			const upload = await binding<R2Bucket>('R2').createMultipartUpload('upload-key', {
				customMetadata: { source: 'test-suite', v: '3' },
			});

			expect(upload).toEqual({
				uploadId: expect.any(String),
				key: 'upload-key',
			});

			const resume = await binding<R2Bucket>('R2').resumeMultipartUpload(
				'upload-key',
				upload.uploadId,
			);

			const part3 = await resume.uploadPart(3, 'part-3');

			const done = await resume.complete([part3]);
			expect(done.key).toEqual('upload-key');

			const value = await binding<R2Bucket>('R2').get('upload-key');
			const uploadedText = await value?.text();
			expect(uploadedText).toEqual('part-3');
		});

		test('delete', async () => {
			let list = await binding<R2Bucket>('R2').list();
			expect(list.objects.length).toEqual(1);

			await binding<R2Bucket>('R2').delete('upload-key');

			list = await binding<R2Bucket>('R2').list();
			expect(list.objects.length).toEqual(0);
		});
	});

	suite('other patches', () => {
		test('Calling `binding()` with a Symbol should not throw error for `startsWith` check', () => {
			const kv = binding<KVNamespace>('KV');
			// @ts-expect-error - testing it doesn't throw an error, not that it works
			expect(kv[Symbol.toStringTag]).toBeDefined();
		});
	});
});
