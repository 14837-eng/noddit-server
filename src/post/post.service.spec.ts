import { NotFoundException, Provider, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  getOneSpy,
  getRawOneSpy,
  mockRepositoryFactory,
  getCountSpy,
  getManySpy,
  findOneSpy,
  saveSpy,
  findSpy,
  deleteSpy,
} from '../shared/mocks/spies.mock';
import {
  mockUserOne,
  mockUserTwo,
  mockSubnodditOne,
  mockSubnodditTwo,
  mockPostVotes,
  mockPosts,
  mockPostsCount,
  mockUpdatePost,
} from '../shared/mocks/data.mock';
import { PostService } from './post.service';
import { PostEntity } from './post.entity';
import { PostVoteEntity } from './post-vote.entity';
import { UserEntity } from '../user/user.entity';
import { SubnodditEntity } from '../subnoddit/subnoddit.entity';
import { FollowerEntity } from '../user/follower.entity';

describe('PostService', () => {
  let postService: PostService;

  const mockRepositories: Provider[] = [];
  const repositoryTokenEntities = [PostEntity, PostVoteEntity, UserEntity, SubnodditEntity, FollowerEntity];

  for (const entity of repositoryTokenEntities) {
    mockRepositories.push({
      provide: getRepositoryToken(entity),
      useFactory: mockRepositoryFactory,
    });
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostService, ...mockRepositories],
    }).compile();

    postService = module.get<PostService>(PostService);
  });

  it('should be defined', () => {
    expect(postService).toBeDefined();
  });

  it('should return one post', async () => {
    const post = mockPosts[0];

    getOneSpy.mockReturnValueOnce(post);
    getRawOneSpy.mockReturnValueOnce(mockPostVotes);
    expect(await postService.findOne(post.id)).toStrictEqual({ post });
  });

  it('should throw not found exception', async () => {
    const postId = 9999;

    getOneSpy.mockReturnValue(undefined);
    await expect(postService.findOne(postId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(postService.findOne(postId)).rejects.toThrowError('Post not found');
  });

  it('should find many posts without any filter', async () => {
    getCountSpy.mockReturnValueOnce(mockPostsCount);
    getManySpy.mockReturnValueOnce(mockPosts);
    getRawOneSpy.mockReturnValue(mockPostVotes);
    expect(await postService.findMany({})).toStrictEqual({ posts: mockPosts, postsCount: mockPostsCount });
  });

  it('should find many posts with specified username, limit and offset', async () => {
    const filter = {
      username: mockUserOne.username,
      limit: 2,
      offset: 1,
    };

    const usernameFilteredPosts = mockPosts.filter(post => {
      return post.user.id === (mockUserOne.username === filter.username ? mockUserOne.id : null);
    });
    const limitAndOffsetFilteredPosts = usernameFilteredPosts.slice(filter.offset, filter.offset + filter.limit);

    getCountSpy.mockReturnValueOnce(mockPostsCount);
    getManySpy.mockReturnValueOnce(limitAndOffsetFilteredPosts);
    getRawOneSpy.mockReturnValue(mockPostVotes);
    findOneSpy.mockReturnValueOnce(mockUserOne);
    expect(await postService.findMany(filter)).toStrictEqual({
      posts: limitAndOffsetFilteredPosts,
      postsCount: mockPostsCount,
    });
  });

  it('should find many posts with specified subnodditId, limit and offset', async () => {
    const filter = {
      subnodditId: mockSubnodditOne.id,
      limit: 2,
      offset: 1,
    };

    const subnodditFilteredPosts = mockPosts.filter(post => {
      return post.subnoddit.id === (mockSubnodditOne.id === filter.subnodditId ? mockSubnodditOne.id : null);
    });
    const limitAndOffsetFilteredPosts = subnodditFilteredPosts.slice(filter.offset, filter.offset + filter.limit);

    getCountSpy.mockReturnValueOnce(mockPostsCount);
    getManySpy.mockReturnValueOnce(limitAndOffsetFilteredPosts);
    getRawOneSpy.mockReturnValue(mockPostVotes);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);
    expect(await postService.findMany(filter)).toStrictEqual({
      posts: limitAndOffsetFilteredPosts,
      postsCount: mockPostsCount,
    });
  });

  it('should throw internal server error if both username and subnodditId are in filter', async () => {
    const filter = {
      username: 'test',
      subnodditId: 1,
    };

    await expect(postService.findMany(filter)).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(postService.findMany(filter)).rejects.toThrowError('Wrong filters');
  });

  it('should throw user not found exception in many posts', async () => {
    const filter = {
      username: 'test',
    };

    findOneSpy.mockReturnValue(undefined);

    await expect(postService.findMany(filter)).rejects.toBeInstanceOf(NotFoundException);
    await expect(postService.findMany(filter)).rejects.toThrowError('User not found');
  });

  it('should throw subnoddit not found exception in many posts', async () => {
    const filter = {
      subnodditId: 1,
    };

    findOneSpy.mockReturnValue(undefined);

    await expect(postService.findMany(filter)).rejects.toBeInstanceOf(NotFoundException);
    await expect(postService.findMany(filter)).rejects.toThrowError('Subnoddit not found');
  });

  it('should return most voted post on top', async () => {
    const unorderedPosts = [];
    let voteSpy = getRawOneSpy;
    for (const post of mockPosts) {
      if (post.id % 2 === 0) {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 0 });
      } else {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 1 });
      }
    }

    const filter: { byVotes: 'DESC' | 'ASC' } = { byVotes: 'DESC' };

    getCountSpy.mockReturnValueOnce(mockPostsCount);
    getManySpy.mockReturnValueOnce(unorderedPosts);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);

    const { posts } = await postService.findMany(filter);

    expect(posts[0].votes).toBe(1);
    expect(posts[posts.length - 1].votes).toBe(0);
  });

  it('should return least voted post on top', async () => {
    const unorderedPosts = [];
    let voteSpy = getRawOneSpy;
    for (const post of mockPosts) {
      if (post.id % 2 === 0) {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 0 });
      } else {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 1 });
      }
    }

    const filter: { byVotes: 'DESC' | 'ASC' } = { byVotes: 'ASC' };

    getCountSpy.mockReturnValueOnce(mockPostsCount);
    getManySpy.mockReturnValueOnce(unorderedPosts);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);

    const { posts } = await postService.findMany(filter);

    expect(posts[0].votes).toBe(0);
    expect(posts[posts.length - 1].votes).toBe(1);
  });

  it('should get news feed without any filter', async () => {
    const posts = mockPosts.filter(post => post.user.id === mockUserTwo.id);
    // user one follows user two
    findSpy.mockReturnValueOnce([mockUserTwo]);
    getCountSpy.mockReturnValueOnce(posts.length);
    getManySpy.mockReturnValueOnce(posts);
    getRawOneSpy.mockReturnValue(mockPostVotes);
    expect(await postService.newsFeed(mockUserOne.id, {})).toStrictEqual({ posts, postsCount: posts.length });
  });

  it('should get news feed with subnodditId, limit and offset', async () => {
    const filter = { subnodditId: 1, limit: 2, offset: 0 };

    const subnodditFilteredPosts = mockPosts.filter(
      post => post.user.id === mockUserTwo.id && post.subnoddit.id === mockSubnodditOne.id,
    );
    const limitAndOffsetFilteredPosts = subnodditFilteredPosts.slice(filter.offset, filter.offset + filter.limit);

    findSpy.mockReturnValueOnce([mockUserTwo]);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);
    getCountSpy.mockReturnValueOnce(subnodditFilteredPosts.length);
    getManySpy.mockReturnValueOnce(limitAndOffsetFilteredPosts);
    getRawOneSpy.mockReturnValue(mockPostVotes);
    expect(await postService.newsFeed(mockUserOne.id, filter)).toStrictEqual({
      posts: limitAndOffsetFilteredPosts,
      postsCount: subnodditFilteredPosts.length,
    });
  });

  it('should throw subnoddit not found in newsfeed', async () => {
    findOneSpy.mockReset();
    findSpy.mockReturnValue([mockUserTwo]);
    findOneSpy.mockReturnValue(undefined);
    await expect(postService.newsFeed(mockUserOne.id, { subnodditId: 9999 })).rejects.toBeInstanceOf(NotFoundException);
    await expect(postService.newsFeed(mockUserOne.id, { subnodditId: 9999 })).rejects.toThrowError(
      'Subnoddit not found',
    );
  });

  it('should return most voted post on top in newsfeed', async () => {
    const filteredPosts = mockPosts.filter(post => post.user.id === mockUserTwo.id);
    const unorderedPosts = [];
    let voteSpy = getRawOneSpy;
    for (const post of filteredPosts) {
      if (post.id % 2 === 0) {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 0 });
      } else {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 1 });
      }
    }

    const filter: { byVotes: 'DESC' | 'ASC' } = { byVotes: 'DESC' };

    findSpy.mockReturnValueOnce([mockUserTwo]);
    getCountSpy.mockReturnValueOnce(filteredPosts.length);
    getManySpy.mockReturnValueOnce(unorderedPosts);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);

    const { posts } = await postService.newsFeed(mockUserOne.id, filter);

    expect(posts[0].votes).toBe(1);
    expect(posts[posts.length - 1].votes).toBe(0);
  });

  it('should return least voted post on top in newsfeed', async () => {
    const filteredPosts = mockPosts.filter(post => post.user.id === mockUserTwo.id);
    const unorderedPosts = [];
    let voteSpy = getRawOneSpy;
    for (const post of filteredPosts) {
      if (post.id % 2 === 0) {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 0 });
      } else {
        unorderedPosts.push(post);
        voteSpy = voteSpy.mockReturnValueOnce({ sum: 1 });
      }
    }

    const filter: { byVotes: 'DESC' | 'ASC' } = { byVotes: 'ASC' };

    findSpy.mockReturnValueOnce([mockUserTwo]);
    getCountSpy.mockReturnValueOnce(filteredPosts.length);
    getManySpy.mockReturnValueOnce(unorderedPosts);
    findOneSpy.mockReturnValueOnce(mockSubnodditOne);

    const { posts } = await postService.newsFeed(mockUserOne.id, filter);

    expect(posts[0].votes).toBe(0);
    expect(posts[posts.length - 1].votes).toBe(1);
  });

  it('should create new post without optional fields', async () => {
    const mockPost = {
      title: mockPosts[0].title,
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      subnodditId: mockPosts[0].subnoddit.id!,
    };

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockSubnodditOne);
    saveSpy.mockReturnValueOnce(mockPosts[0]);

    const { post } = await postService.create(mockUserOne.id, mockPost);

    expect(post.id).toBe(mockPosts[0].id);
    expect(post.title).toBe(mockPost.title);
    expect(post.subnoddit.id).toBe(mockPost.subnodditId);
    expect(post.user.id).toBe(mockUserOne.id);
  });

  it('should create new post with optional fields', async () => {
    const mockPost = {
      title: mockPosts[0].title,
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      subnodditId: mockPosts[0].subnoddit.id!,
      text: mockPosts[0].text,
      attachment: mockPosts[0].attachment,
    };

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockSubnodditOne);
    saveSpy.mockReturnValueOnce(mockPosts[0]);

    const { post } = await postService.create(mockUserOne.id, mockPost);

    expect(post.id).toBe(mockPosts[0].id);
    expect(post.title).toBe(mockPost.title);
    expect(post.subnoddit.id).toBe(mockPost.subnodditId);
    expect(post.user.id).toBe(mockUserOne.id);
  });

  it('should throw user not found exception while creating post', async () => {
    const mockPost = {
      title: mockPosts[0].title,
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      subnodditId: mockPosts[0].subnoddit.id!,
      text: mockPosts[0].text,
    };

    findOneSpy.mockReset();
    findOneSpy.mockReturnValue(undefined);

    await expect(postService.create(mockUserOne.id, mockPost)).rejects.toBeInstanceOf(NotFoundException);
    await expect(postService.create(mockUserOne.id, mockPost)).rejects.toThrowError('User not found');
  });

  it('should throw subnoddit not found exception while creating post', async () => {
    const mockPost = {
      title: mockPosts[0].title,
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      subnodditId: mockPosts[0].subnoddit.id!,
      text: mockPosts[0].text,
    };

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(undefined);
    await expect(postService.create(mockUserOne.id, mockPost)).rejects.toBeInstanceOf(NotFoundException);

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(undefined);
    await expect(postService.create(mockUserOne.id, mockPost)).rejects.toThrowError('Subnoddit not found');
  });

  it('should update post', async () => {
    const mockPost = mockPosts[0];
    const updatedMockPost = { ...mockPost, ...mockUpdatePost };

    getOneSpy.mockReturnValueOnce(mockPost);
    findOneSpy.mockReturnValueOnce(mockSubnodditTwo);
    saveSpy.mockReturnValueOnce(updatedMockPost);

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    const { post } = await postService.update(mockPost.user.id!, mockPost.id, mockUpdatePost);

    expect(post).toStrictEqual(updatedMockPost);
  });

  it('should throw post not found exception while updating', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValue(undefined);

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.update(mockPost.user.id!, mockPost.id, mockUpdatePost)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.update(mockPost.user.id!, mockPost.id, mockUpdatePost)).rejects.toThrowError(
      'Post not found',
    );
  });

  it('should throw unauthorized exception if user is not post author while updating', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValueOnce(mockPost);

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.update(mockUserTwo.id, mockPost.id, mockUpdatePost)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should throw subnoddit not found error while updating', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValue(mockPost);
    findOneSpy.mockReturnValue(undefined);

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.update(mockPost.user.id!, mockPost.id, mockUpdatePost)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.update(mockPost.user.id!, mockPost.id, mockUpdatePost)).rejects.toThrowError(
      'Subnoddit not found',
    );
  });

  //
  it('should delete post', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValueOnce(mockPost);
    deleteSpy.mockReturnValueOnce({ affected: 1 });

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    const res = await postService.delete(mockPost.user.id!, mockPost.id);

    expect(res).toStrictEqual({ message: 'Post successfully removed.' });
  });

  it('should throw post not found exception while deleting', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValue(undefined);

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.delete(mockPost.user.id!, mockPost.id)).rejects.toBeInstanceOf(NotFoundException);
    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.delete(mockPost.user.id!, mockPost.id)).rejects.toThrowError('Post not found');
  });

  it('should throw unauthorized exception if user is not post author while deleting', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValueOnce(mockPost);

    await expect(postService.delete(mockUserTwo.id, mockPost.id)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should throw internal server error exception if more than one post got affected while deleting', async () => {
    const mockPost = mockPosts[0];

    getOneSpy.mockReturnValueOnce(mockPost);
    deleteSpy.mockReturnValueOnce({ affected: 2 });

    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    await expect(postService.delete(mockPost.user.id!, mockPost.id)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('should upvote post', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce(undefined);

    expect(await postService.vote(mockUserOne.id, mockPost.id, { direction: 1 })).toStrictEqual({
      message: 'Post upvoted successfully',
    });
  });

  it('should downvote post', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce(undefined);

    expect(await postService.vote(mockUserOne.id, mockPost.id, { direction: -1 })).toStrictEqual({
      message: 'Post downvoted successfully',
    });
  });

  it('should reset post votes to 0 if direction(1) is the same', async () => {
    const mockPost = mockPosts[0];
    const mockPostVoteOne = { direction: 1 };

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce(mockPostVoteOne);

    expect(await postService.vote(mockUserOne.id, mockPost.id, mockPostVoteOne)).toStrictEqual({
      message: 'Post vote reset',
    });
  });

  it('should reset post votes to 0 if direction(-1) is the same', async () => {
    const mockPost = mockPosts[0];
    const mockPostVoteNegOne = { direction: -1 };

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce(mockPostVoteNegOne);

    expect(await postService.vote(mockUserOne.id, mockPost.id, mockPostVoteNegOne)).toStrictEqual({
      message: 'Post vote reset',
    });
  });

  it('should upvote post where post vote already exists and is 0', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce({ direction: 0 });

    expect(await postService.vote(mockUserOne.id, mockPost.id, { direction: 1 })).toStrictEqual({
      message: 'Post upvoted',
    });
  });

  it('should downvote post where post vote already exists and is 0', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(mockPost);

    getOneSpy.mockReturnValueOnce({ direction: 0 });

    expect(await postService.vote(mockUserOne.id, mockPost.id, { direction: -1 })).toStrictEqual({
      message: 'Post downvoted',
    });
  });

  it('should downvote post where post vote already exists and is 0', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValue(undefined);

    await expect(postService.vote(mockUserOne.id, mockPost.id, { direction: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(postService.vote(mockUserOne.id, mockPost.id, { direction: 999 })).rejects.toThrowError(
      'User not found',
    );
  });

  it('should downvote post where post vote already exists and is 0', async () => {
    const mockPost = mockPosts[0];

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(undefined);
    await expect(postService.vote(mockUserOne.id, mockPost.id, { direction: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    findOneSpy.mockReturnValueOnce(mockUserOne).mockReturnValueOnce(undefined);
    await expect(postService.vote(mockUserOne.id, mockPost.id, { direction: 999 })).rejects.toThrowError(
      'Post not found',
    );
  });
});
