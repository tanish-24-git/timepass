async function fetchRepoContents(octokit, owner, repo, path = '') {
  const { data } = await octokit.repos.getContent({ owner, repo, path });
  let contents = '';
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.type === 'file') {
        const { data: fileData } = await octokit.repos.getContent({ owner, repo, path: item.path });
        contents += `${item.path}:\n${Buffer.from(fileData.content, 'base64').toString('utf-8')}\n\n`;
      } else if (item.type === 'dir') {
        contents += await fetchRepoContents(octokit, owner, repo, item.path);
      }
    }
  }
  return contents;
}

module.exports = fetchRepoContents;